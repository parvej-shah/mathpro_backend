require("dotenv").config();

const { Service } = require("../service/base");

const seeds = [
  {
    seedId: "seed_testimonial_1",
    courseId: "8",
    userId: "1",
    rating: 5,
    category: "course",
    sortOrder: 1,
    comment:
      "The higher math lessons are much clearer than my coaching notes. The step-by-step explanations helped me build confidence before exams.",
  },
  {
    seedId: "seed_testimonial_2",
    courseId: "9",
    userId: "4",
    rating: 5,
    category: "instructor",
    sortOrder: 2,
    comment:
      "I liked how the instructor solved the same problem in more than one way. That made the SSC math tricks easier to remember.",
  },
  {
    seedId: "seed_testimonial_3",
    courseId: "10",
    userId: "1",
    rating: 4,
    category: "content",
    sortOrder: 3,
    comment:
      "The Class 8 batch feels organized and beginner-friendly. Practice sheets and recorded explanations are both useful for revision.",
  },
  {
    seedId: "seed_testimonial_4",
    courseId: "8",
    userId: "4",
    rating: 5,
    category: "platform",
    sortOrder: 4,
    comment:
      "I could quickly revisit difficult chapters from the recordings. The platform made it easy to continue practice without losing momentum.",
  },
];

async function main() {
  const service = new Service();
  const now = Math.trunc(Date.now() / 1000);
  const summary = [];

  for (const item of seeds) {
    const feedbackResult = await service.query(
      `INSERT INTO feedbacks (id, course_id, user_id, rating, comment, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (course_id, user_id)
       DO UPDATE SET
         rating = EXCLUDED.rating,
         comment = EXCLUDED.comment,
         category = EXCLUDED.category,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, course_id, user_id, rating, category`,
      [
        item.seedId,
        item.courseId,
        item.userId,
        item.rating,
        item.comment,
        item.category,
      ],
    );

    if (!feedbackResult.success || feedbackResult.data.length === 0) {
      throw feedbackResult.error || new Error(`Failed to seed feedback ${item.seedId}`);
    }

    const feedbackId = String(feedbackResult.data[0].id);

    const testimonialResult = await service.query(
      `INSERT INTO public_testimonial (feedback_id, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, TRUE, $3, $3)
       ON CONFLICT (feedback_id)
       DO UPDATE SET
         sort_order = EXCLUDED.sort_order,
         is_active = TRUE,
         updated_at = EXCLUDED.updated_at
       RETURNING feedback_id, sort_order, is_active`,
      [feedbackId, item.sortOrder, now],
    );

    if (!testimonialResult.success || testimonialResult.data.length === 0) {
      throw testimonialResult.error || new Error(`Failed to feature feedback ${feedbackId}`);
    }

    summary.push({
      feedback_id: feedbackId,
      course_id: item.courseId,
      user_id: item.userId,
      sort_order: item.sortOrder,
    });
  }

  console.log(JSON.stringify({ success: true, seeded: summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
