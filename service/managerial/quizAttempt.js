const Service = require('../base').Service;
const CryptoJS = require('crypto-js');

// Quiz correct-answers are stored AES-encrypted by the admin client (same
// `crypto-js` scheme the frontend uses to decrypt). Grading runs here so the
// answer key never ships to the browser and the verdict is tamper-proof.
//
// Existing answers were authored across two key eras, so we try the primary
// key (SECRET_KEY_QUIZ) and fall back to the secondary (SECRET_KEY_QUIZ_ALT).
// A key mismatch / plaintext makes toString(Utf8) throw "Malformed UTF-8 data"
// or yield "" — treated as "this key didn't work", so we try the next one.
function tryDecrypt(encryptedText, key) {
    if (!key) return '';
    try {
        return CryptoJS.AES.decrypt(String(encryptedText || ''), key).toString(CryptoJS.enc.Utf8);
    } catch {
        return '';
    }
}

function decryptAnswer(encryptedText) {
    const primary = tryDecrypt(encryptedText, process.env.SECRET_KEY_QUIZ || '');
    if (primary !== '') return primary;
    return tryDecrypt(encryptedText, process.env.SECRET_KEY_QUIZ_ALT || '');
}

class QuizAttemptService extends Service {
    constructor() {
        super();
    }

    // Return the saved attempt for a student, or { submitted: false }.
    getAttempt = async (user_id, module_id) => {
        const result = await this.query(
            `select answers, verdict, score from quiz_attempt where user_id=$1 and module_id=$2 limit 1`,
            [user_id, module_id]
        );
        if (!result.success) return { success: false, error: result.error };

        if (result.data.length === 0) {
            return { success: true, data: { submitted: false } };
        }
        const row = result.data[0];
        return {
            success: true,
            data: {
                submitted: true,
                answers: row.answers,
                verdict: row.verdict,
                score: row.score,
            },
        };
    }

    // Grade `answers` ({ "<index>": "<selected option text>" }) against the
    // module's encrypted answer key, then persist the attempt + a `progress`
    // row in one transaction. One attempt only — rejects if already submitted.
    submitAttempt = async (user_id, module_id, answers) => {
        const client = await this.getClient();
        const timestamp = parseInt(Date.now() / 1000);

        try {
            await client.query('BEGIN');

            const moduleRes = await client.query(
                `select data, score from module where id=$1 limit 1`,
                [module_id]
            );
            if (moduleRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return { success: false, error: 'Module not found' };
            }

            const moduleData = moduleRes.rows[0].data || {};
            const moduleScore = moduleRes.rows[0].score || 0;
            const quizzes = Array.isArray(moduleData.quiz) ? moduleData.quiz : [];
            if (quizzes.length === 0) {
                await client.query('ROLLBACK');
                return { success: false, error: 'Module has no quiz' };
            }

            // One attempt only — `progress` is the existing one-row-per-quiz lock.
            const existingProgress = await client.query(
                `select 1 from progress where user_id=$1 and module_id=$2 limit 1`,
                [user_id, module_id]
            );
            if (existingProgress.rows.length > 0) {
                await client.query('ROLLBACK');
                return { success: false, error: 'Quiz already submitted' };
            }

            const verdict = [];
            let acceptedPoints = 0;
            let totalPoints = 0;

            quizzes.forEach((quiz, index) => {
                const questionPoints = typeof quiz.points === 'number' && quiz.points > 0
                    ? quiz.points
                    : 1;
                totalPoints += questionPoints;

                const correct = decryptAnswer(quiz.answer || quiz.correct_answer || '');
                if (correct !== '' && correct === answers[index]) {
                    verdict.push(true);
                    acceptedPoints += questionPoints;
                } else {
                    verdict.push(false);
                }
            });

            const score = totalPoints > 0
                ? Math.round((acceptedPoints / totalPoints) * moduleScore)
                : 0;

            await client.query(
                `insert into quiz_attempt(user_id,module_id,answers,verdict,score,timestamp)
                 values($1,$2,$3,$4,$5,$6)`,
                [user_id, module_id, JSON.stringify(answers), JSON.stringify(verdict), score, timestamp]
            );
            await client.query(
                `insert into progress(user_id,module_id,point,timestamp) values($1,$2,$3,$4)`,
                [user_id, module_id, score, timestamp]
            );

            await client.query('COMMIT');

            return {
                success: true,
                data: { submitted: true, answers, verdict, score },
            };
        } catch (e) {
            await client.query('ROLLBACK');
            return { success: false, error: e };
        } finally {
            client.release();
        }
    }
}

module.exports = { QuizAttemptService };
