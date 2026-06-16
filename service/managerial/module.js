const Service = require('../base').Service;

class ModuleService extends Service {
    constructor() {
        super();
    }
    table = `module`
    pk = `id`
    fk = `chapter_id`
    cols = [
        `title`,
        `description`,
        `metadata`,
        `data`,
        `is_live`,
        `is_free`,
        `serial`,
        `score`
    ]
    types = [
        `string`,
        `string`,
        `object`,
        `object`,
        `boolean`,
        `boolean`,
        `integer`,
        `integer`
    ]
    getColumns = () => {
        var result = `(`
        this.cols.map((c, i) => {
            result += `${c},`
        })
        result += `${this.fk}`
        return `${result})`
    }
    getWildCards = () => {
        var result = `(`
        var fields = [...this.cols, this.fk]
        fields.map((_, i) => {
            result += `$${(i + 1)}`;
            if (i < fields.length - 1) result += ','
        })
        return result + ')'
    }
    getUpdatePairs = () => {
        var result = ``
        this.cols.map((c, i) => {
            result += `
                ${c} = $${(i + 1)}`
            if (i < this.cols.length - 1) result += ','
        })
        return result
    }

    list = async (fk_id) => {
        var query = `
            SELECT m.*
            FROM ${this.table} m
            WHERE m.${this.fk} = $1
            ORDER BY m.serial
        `
        var params = [fk_id]
        var result = await this.query(query, params)
        return result
    }

    promoteScheduledToLive = async () => {
        var query = `
            UPDATE module
            SET live_status = 'LIVE'
            WHERE live_status = 'SCHEDULED'
            AND live_scheduled_at <= extract(epoch from now())
        `
        await this.query(query, [])
    }

    getLiveModulesForUser = async (user_id) => {
        await this.promoteScheduledToLive()
        var query = `
            SELECT m.id, m.title, m.data, m.is_live, m.live_status, m.live_meeting_id,
                m.live_meeting_pass, m.live_scheduled_at, co.id as course_id, co.title as course_title
            FROM module m
            JOIN chapter c ON m.chapter_id = c.id
            JOIN course co ON c.course_id = co.id
            WHERE m.live_status IN ('SCHEDULED', 'LIVE')
            AND co.id IN (
                SELECT course_id FROM takes WHERE user_id = $1
                UNION
                SELECT bc.course_id FROM bundle_course bc
                JOIN bundle_purchase bp ON bc.bundle_id = bp.bundle_id
                WHERE bp.user_id = $1
            )
            ORDER BY (CASE m.live_status WHEN 'LIVE' THEN 0 ELSE 1 END), m.live_scheduled_at ASC
        `
        var params = [user_id]
        var result = await this.query(query, params)
        return result
    }

    getLiveModulesForCourse = async (user_id, course_id) => {
        await this.promoteScheduledToLive()
        var query = `
            SELECT m.id, m.title, m.data, m.is_live, m.live_status, m.live_meeting_id,
                m.live_meeting_pass, m.live_scheduled_at, co.id as course_id, co.title as course_title
            FROM module m
            JOIN chapter c ON m.chapter_id = c.id
            JOIN course co ON c.course_id = co.id
            WHERE m.live_status IN ('SCHEDULED', 'LIVE')
            AND co.id = $2
            AND co.id IN (
                SELECT course_id FROM takes WHERE user_id = $1
                UNION
                SELECT bc.course_id FROM bundle_course bc
                JOIN bundle_purchase bp ON bc.bundle_id = bp.bundle_id
                WHERE bp.user_id = $1
            )
            ORDER BY (CASE m.live_status WHEN 'LIVE' THEN 0 ELSE 1 END), m.live_scheduled_at ASC
        `
        var params = [user_id, course_id]
        var result = await this.query(query, params)
        return result
    }

    getCurrentProgress = async (user_id, course_id) => {
        if (!user_id) return 0;
        else {
            //SELECT MAX(p.module_id) as mid from progress p,module m,chapter c where p.user_id=6 and p.module_id=m.id and m.chapter_id=c.id and c.course_id=5 
            var query = `SELECT MAX(m.serial) as mid from progress p,module m,chapter c where p.user_id=$1 and p.module_id=m.id and m.chapter_id=c.id and c.course_id=$2`
            var params = [user_id, course_id]
            var result = await this.query(query, params)
            // console.log(query, params)
            if (!result.success || result.data[0].mid === null) return 0
            return parseInt(result.data[0].mid)
        }
    }

    //SELECT SUM(m.score) as s from progress p,module m,chapter c where p.user_id=6 and p.module_id=m.id and m.chapter_id=c.id and c.course_id=1

    create = async (fk_id, reqObj) => {
        var query = `
            insert into ${this.table}${this.getColumns()} values ${this.getWildCards()} returning ${this.pk}
        `
        var params = [...this.cols.map(c => { return reqObj[c] }), fk_id]
        var result = await this.query(query, params)
        return result
    }
    update = async (id, reqObj) => {
        var query = `
            update ${this.table} set ${this.getUpdatePairs()} where ${this.pk}=$${(this.cols.length + 1)}
        `
        var params = [...this.cols.map(c => { return reqObj[c] }), id]
        var result = await this.query(query, params)
        return result
    }
    get = async id => {
        var query = `
            SELECT m.*
            FROM ${this.table} m
            WHERE m.${this.pk}=$1
        `
        var params = [id]
        var result = await this.query(query, params)
        return result
    }

    deleteEntry = async id => {
        var query = `delete from ${this.table} where ${this.pk}=$1`
        var params = [id]
        var result = await this.query(query, params)
        return result
    }

    completeModule = async (user_id, module_id, points, type) => {
        const client = await this.getClient();
        const timestamp = parseInt(Date.now() / 1000);

        try {
            await client.query('BEGIN');

            const existingProgress = await client.query(
                `select 1 from progress where user_id=$1 and module_id=$2 limit 1`,
                [user_id, module_id]
            );

            if (type === 'QUIZ' && existingProgress.rows.length > 0) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: 'Quiz already submitted'
                };
            }

            if (existingProgress.rows.length > 0) {
                // Progress row exists (could be a quiz score). Don't overwrite it.
                await client.query('ROLLBACK');
                return { success: true, data: [], rowCount: 0 };
            }

            const result = await client.query(
                `insert into progress(user_id,module_id,point,timestamp) values($1,$2,$3,$4)`,
                [user_id, module_id, points, timestamp]
            );

            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows,
                rowCount: result.rowCount
            };
        } catch (e) {
            await client.query('ROLLBACK');
            return {
                success: false,
                error: e
            }
        } finally {
            client.release();
        }

    }

}

module.exports = { ModuleService }
