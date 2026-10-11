const { CrudService } = require("../shared/crudService");
const { safeMessage } = require('../../errors/dbErrors');

class ChapterService extends CrudService {
  constructor() {
    super();
  }
  table = `chapter`;
  pk = `id`;
  fk = `course_id`;
  cols = [`title`, `chips_list`, `is_free`, `is_live`, `serial`];
  types = [`string`, `object`, `boolean`, `boolean`, `integer`];

  list = async (fk_id) => {
    var query = `select * from ${this.table} where ${this.fk} = $1 order by serial`;
    var params = [fk_id];
    var result = await this.query(query, params);
    return result;
  };
  create = async (fk_id, reqObj) => {
    var query = `
            insert into ${
              this.table
            }${this.getColumns()} values ${this.getWildCards()} returning ${
      this.pk
    }
        `;
    var params = [
      ...this.cols.map((c) => {
        return reqObj[c];
      }),
      fk_id,
    ];
    var result = await this.query(query, params);
    return result;
  };
  update = async (id, reqObj) => {
    // Fetch existing chapter to preserve values for fields not provided
    var existingChapterQuery = await this.query(
      `select * from ${this.table} where ${this.pk} = $1`,
      [id]
    );
    
    if (!existingChapterQuery.success || existingChapterQuery.data.length === 0) {
      return {
        success: false,
        error: 'Chapter not found',
        code: 'CHAPTER_NOT_FOUND'
      };
    }
    
    var existingChapter = existingChapterQuery.data[0];
    var is_live_status = existingChapter.is_live;
    var is_live_updated_status = reqObj["is_live"];
    
    var query = `
            update ${this.table} set ${this.getUpdatePairs()} where ${
      this.pk
    }=$${this.cols.length + 1}
        `;
    var params = [
      ...this.cols.map((c) => {
        // If field is not provided in update, use existing value
        if (reqObj[c] === undefined) {
          return existingChapter[c];
        }
        return reqObj[c];
      }),
      id,
    ];
    if (is_live_status == false && is_live_updated_status == true) {
      var chapterResult= await this.query(
        `SELECT title from ${this.table} where id = $1`,
        [id]
      );
      var chapterName = chapterResult.data[0].title;
      var query2 = `INSERT INTO notification (type, data, user_id, course_id, is_read, timestamp)
                    SELECT 
	                    $1 AS type,
                        $2 AS data,
                        t.user_id AS user_id,
                        c.course_id AS course_id,
                        $3 AS is_read,
                        $4 AS timestamp
                    FROM chapter AS c
                    JOIN takes AS t ON c.course_id = t.course_id
                    WHERE c.id = $5`;
      var params2 = [
        "COURSE_UPDATE",
        {
          title: `${chapterName} is unlocked now!`,
          body: " ",
          moduleData: { chapterId: id, title: chapterName }, //NEED TO FIX MODULE DATA TO CHAPTER DATA 
        },
        false,
        parseInt(Date.now() / 1000),
        id,
      ];
      var notification_generator = await this.query(query2,params2);
    }
    var result = await this.query(query, params);
    return result;
  };
  deleteEntry = async (id) => {
    try {
        return await this.withTransaction(async (client) => {
          const modulesRes = await client.query("select id from module where chapter_id=$1", [id]);
          const moduleIds = modulesRes.rows.map(r => r.id);
          if (moduleIds.length > 0) {
            await client.query("delete from progress where module_id = ANY($1::int[])", [moduleIds]);
            await client.query("delete from module_feedback where module_id = ANY($1::int[])", [moduleIds]);
            await client.query("delete from user_module_views where module_id = ANY($1::int[])", [moduleIds]);
            await client.query("delete from module where id = ANY($1::int[])", [moduleIds]);
          }
          const query = `delete from ${this.table} where ${this.pk}=$1 returning *`;
          const result = await client.query(query, [id]);
          return {
            success: true,
            data: result.rows,
          };
        });
    } catch (error) {
      return {
        success: false,
        error: safeMessage(error),
      };
    }
  };
}

module.exports = { ChapterService };
