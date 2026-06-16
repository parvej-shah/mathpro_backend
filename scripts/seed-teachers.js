#!/usr/bin/env node
/**
 * Seed premium teacher (managerial_auth) records for the About section.
 *
 * Uses ON CONFLICT (login) DO UPDATE so it is safe to re-run — existing rows
 * are updated in place and no duplicates are created.
 *
 * Usage:
 *   node scripts/seed-teachers.js
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Service } = require("../service/base");
const { managerialAccountTypes } = require("../util/constants");

const teachers = [
  {
    name: "মো. রাফিউল ইসলাম",
    login: "teacher.rafiul@mathpro.bd",
    role: "প্রধান গণিত শিক্ষক",
    university: "ঢাকা বিশ্ববিদ্যালয়, গণিত বিভাগ",
    credibility: "ঢাকা বিশ্ববিদ্যালয় থেকে গণিতে স্নাতকোত্তর। ১৫ বছরের অভিজ্ঞতায় হাজারো শিক্ষার্থীকে SSC ও HSC গণিতে A+ পেতে সাহায্য করেছি।",
    image: null,
    achievements: [
      "SSC গণিত অলিম্পিয়াডে জাতীয় পর্যায়ে বিচারক",
      "৫,০০০+ শিক্ষার্থীকে A+ পেতে সাহায্য করেছেন",
      "MathPro প্ল্যাটফর্মের প্রতিষ্ঠাতা শিক্ষক",
      "ঢাকা বিশ্ববিদ্যালয় থেকে গণিতে স্নাতকোত্তর",
    ],
    social: {
      facebook: "https://facebook.com",
    },
  },
  {
    name: "নাসরিন আক্তার",
    login: "teacher.nasrin@mathpro.bd",
    role: "HSC উচ্চতর গণিত বিশেষজ্ঞ",
    university: "বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয় (BUET)",
    credibility: "BUET থেকে প্রকৌশলে স্নাতক। HSC উচ্চতর গণিত ও ক্যালকুলাসে ১০ বছরের বিশেষজ্ঞ অভিজ্ঞতা।",
    image: null,
    achievements: [
      "BUET থেকে ইলেকট্রিক্যাল ইঞ্জিনিয়ারিংয়ে স্নাতক",
      "HSC পদার্থবিজ্ঞান ও গণিত উভয় বিষয়ে পাঠদান",
      "৩,০০০+ শিক্ষার্থীর ভর্তি পরীক্ষায় সফলতা",
      "অনলাইন গণিত শিক্ষায় জাতীয় পুরস্কারপ্রাপ্ত",
    ],
    social: {
      linkedin: "https://linkedin.com",
    },
  },
  {
    name: "আরিফ হোসেন",
    login: "teacher.arif@mathpro.bd",
    role: "JSC ও SSC গণিত মেন্টর",
    university: "জাহাঙ্গীরনগর বিশ্ববিদ্যালয়, গণিত",
    credibility: "জাহাঙ্গীরনগর বিশ্ববিদ্যালয় থেকে গণিতে অনার্স। সহজ ভাষায়, মজার উপায়ে গণিত বোঝানোয় ৮ বছরের অভিজ্ঞতা।",
    image: null,
    achievements: [
      "জাহাঙ্গীরনগর বিশ্ববিদ্যালয় থেকে গণিতে প্রথম শ্রেণি",
      "JSC ও SSC গণিতের ২০০+ ভিডিও লেকচার তৈরি",
      "শিক্ষার্থীদের পছন্দের শিক্ষক — ২০২৩ রেটিং ৪.৯/৫",
      "গণিত অলিম্পিয়াড ট্রেনিং ক্যাম্পে প্রশিক্ষক",
    ],
    social: {
      facebook: "https://facebook.com",
      website: "https://mathpro.bd",
    },
  },
];

async function main() {
  const service = new Service();
  const salt = await bcrypt.genSalt(10);
  // Placeholder password — teachers log in via the admin panel with their own credentials
  const hashedPassword = await bcrypt.hash("MathPro@2024!", salt);

  const summary = [];

  for (const t of teachers) {
    const profile = {
      role: t.role,
      university: t.university,
      credibility: t.credibility,
      image: t.image,
      achievements: t.achievements,
      social: t.social,
      category: "instructor",
      isActive: true,
    };

    const result = await service.query(
      `INSERT INTO managerial_auth (name, type, login, email, phone, profile, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (login) DO UPDATE SET
         name     = EXCLUDED.name,
         profile  = EXCLUDED.profile,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, name, login`,
      [
        t.name,
        managerialAccountTypes.regular,
        t.login,
        t.login, // login is email format
        null,
        JSON.stringify(profile),
        hashedPassword,
      ]
    );

    if (!result.success || result.data.length === 0) {
      throw result.error || new Error(`Failed to seed teacher: ${t.name}`);
    }

    summary.push({ id: result.data[0].id, name: result.data[0].name, login: result.data[0].login });
  }

  console.log(JSON.stringify({ success: true, seeded: summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
