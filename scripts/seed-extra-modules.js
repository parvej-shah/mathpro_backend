require("dotenv").config();

const CryptoJS = require("crypto-js");
const { Service } = require("../service/base");

// Must match NEXT_PUBLIC_SECRET_KEY_QUIZ in MathPro_Frontend/.env
const QUIZ_SECRET_KEY = "2wdIZjleuiYAI4hqGqzWcT+uCEi8OcMZ";

const encrypt = (text) => CryptoJS.AES.encrypt(text, QUIZ_SECRET_KEY).toString();

// chapter_id -> starting serial (one past the current max for that chapter)
const chapters = [
  { chapterId: 1, startSerial: 13 }, // course 8 - HSC Higher Math 1st Paper
  { chapterId: 3, startSerial: 13 }, // course 9 - SSC General Math
  { chapterId: 8, startSerial: 1 },  // course 7 - Discrete Mathematics Mastery
  { chapterId: 9, startSerial: 14 }, // course 10 - Class 8 Math Master Batch 2026
];

function buildModules(startSerial) {
  return [
    {
      title: "অধ্যায় সংক্ষিপ্ত পাঠ",
      description:
        "<p>এই পাঠে আমরা অধ্যায়ের মূল ধারণাগুলো সংক্ষেপে আলোচনা করব। নিচের পয়েন্টগুলো মনে রাখুন:</p><ul><li>সংজ্ঞা ও মূল সূত্র</li><li>উদাহরণ সমাধান</li><li>সাধারণ ভুলগুলো এড়ানোর উপায়</li></ul>",
      serial: startSerial,
      score: 0,
      is_live: true,
      is_free: false,
      data: { category: "TEXT" },
    },
    {
      title: "অনুশীলন শীট (PDF)",
      description: "এই অধ্যায়ের অনুশীলনীর জন্য পিডিএফ ফাইলটি দেখুন।",
      serial: startSerial + 1,
      score: 0,
      is_live: true,
      is_free: false,
      data: {
        category: "PDF",
        pdf_link: "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/preview",
        pdf_drive_link: "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view",
        pdf_source: "drive",
      },
      pdf_drive_link: "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view",
    },
    {
      title: "অধ্যায় কুইজ",
      description: "নিচের প্রশ্নগুলোর উত্তর দিয়ে নিজেকে যাচাই করুন।",
      serial: startSerial + 2,
      score: 5,
      is_live: true,
      is_free: false,
      quiz_time_limit: 10,
      quiz_attempt_limit: 1,
      data: {
        category: "QUIZ",
        quiz_time_limit: 10,
        quiz_attempt_limit: 1,
        quiz: [
          {
            question: "১ + ১ = ?",
            question_html: "<p>১ + ১ = ?</p>",
            question_latex: null,
            options: ["১", "২", "৩", "৪"],
            options_html: ["১", "২", "৩", "৪"],
            answer: encrypt("২"),
            explanation: encrypt("১ এবং ১ যোগ করলে ২ হয়।"),
            explanation_html: encrypt("<p>১ এবং ১ যোগ করলে ২ হয়।</p>"),
            explanation_latex: null,
            points: 2,
          },
          {
            question: "৫ এর বর্গ কত?",
            question_html: "<p>৫ এর বর্গ কত?</p>",
            question_latex: null,
            options: ["১০", "১৫", "২০", "২৫"],
            options_html: ["১০", "১৫", "২০", "২৫"],
            answer: encrypt("২৫"),
            explanation: encrypt("৫ × ৫ = ২৫"),
            explanation_html: encrypt("<p>৫ × ৫ = ২৫</p>"),
            explanation_latex: null,
            points: 3,
          },
        ],
      },
    },
  ];
}

async function main() {
  const service = new Service();
  const summary = [];

  for (const { chapterId, startSerial } of chapters) {
    const modules = buildModules(startSerial);

    for (const m of modules) {
      const result = await service.query(
        `INSERT INTO module
          (chapter_id, title, description, metadata, data, is_live, is_free, serial, score, quiz_time_limit, quiz_attempt_limit, pdf_drive_link)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, chapter_id, title, serial`,
        [
          chapterId,
          m.title,
          m.description,
          null,
          JSON.stringify(m.data),
          m.is_live,
          m.is_free,
          m.serial,
          m.score,
          m.quiz_time_limit || null,
          m.quiz_attempt_limit || null,
          m.pdf_drive_link || null,
        ],
      );

      if (!result.success) {
        throw result.error || new Error(`Failed to seed module "${m.title}"`);
      }

      summary.push(result.data[0]);
    }
  }

  console.log(JSON.stringify({ success: true, seeded: summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
