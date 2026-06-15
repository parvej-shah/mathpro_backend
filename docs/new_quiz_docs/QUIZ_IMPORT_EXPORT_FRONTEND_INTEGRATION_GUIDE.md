# Quiz Import/Export - Frontend Integration Guide

**Date:** January 2026  
**Version:** 2.0 (Redesigned)  
**API Version:** V2  
**Status:** ✅ Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Context & Problem](#context--problem)
3. [Solution Overview](#solution-overview)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Formats](#requestresponse-formats)
6. [Error Handling](#error-handling)
7. [Integration Steps](#integration-steps)
8. [Code Examples](#code-examples)
9. [JSON Template Handling](#json-template-handling)
10. [Testing Checklist](#testing-checklist)

---

## 🎯 Overview

This guide provides complete integration instructions for the redesigned Quiz Import/Export API. The new design simplifies the import process by removing encryption requirements and allowing admins to manually select answers after import.

### Key Changes from Previous Version

- ✅ **No encryption required during import** - Questions and options only
- ✅ **Manual answer selection** - Admin selects answers in UI after import
- ✅ **Plain text focus** - Admins upload plain text, HTML fields optional
- ✅ **Simplified workflow** - Import → Display → Select Answers → Save

---

## 🚨 Context & Problem

### Why This Redesign?

**Original Problem:**
The previous quiz import API required frontend to encrypt answers before sending. However, encryption was failing during import, causing:
- Corrupted quiz data
- Data loss
- Poor user experience
- Difficult debugging

**Pain Points:**
1. Encryption failures during import
2. No way to verify answers before saving
3. Complex encryption workflow
4. Error-prone process

### Solution

**New Approach:**
1. **Import**: Only questions and options (no answers/explanations)
2. **Display**: Questions appear in modal immediately after import
3. **Manual Selection**: Admin selects answers via radio buttons
4. **Save**: Frontend encrypts and saves complete quiz data

---

## ✅ Solution Overview

### Workflow

```
1. Admin opens module editor modal
2. Admin clicks "Import from JSON" button
3. Admin uploads JSON file (plain text, questions + options only)
4. Frontend calls: POST /v2/admin/module/{moduleId}/quiz/import
5. Backend validates and stores questions/options (no answers)
6. Backend returns success response
7. Frontend refetches module data (or uses response data)
8. Questions appear in QuizBuilder component (modal stays open)
9. Admin manually selects correct answer for each question (radio buttons)
10. Admin optionally adds explanation for each question (rich text editor)
11. Admin clicks "Save Module" button
12. Frontend encrypts answers/explanations using CryptoJS
13. Frontend calls: PUT /v2/admin/module/{moduleId}/update-enhanced
14. Backend saves complete quiz data (with encrypted answers)
15. Success! ✅
```

### Key Benefits

- ✅ **No encryption failures** - Encryption happens only during save
- ✅ **Better UX** - Admins see imported questions immediately
- ✅ **Manual control** - Admins verify and select answers
- ✅ **Flexibility** - Admins can edit questions/options after import
- ✅ **Clear separation** - Backend handles storage, frontend handles UI

---

## 🔌 API Endpoints

### 1. Import Quiz

**Endpoint:** `POST /v2/admin/module/{moduleId}/quiz/import`

**Authentication:** Required (Bearer token)

**Description:** Import quiz questions and options only. No answers or explanations required.

---

### 2. Export Quiz

**Endpoint:** `GET /v2/admin/module/{moduleId}/quiz/export?format=full&include_answers=true`

**Authentication:** Required (Bearer token)

**Description:** Export complete quiz data including encrypted answers/explanations.

**Note:** This endpoint is **unchanged** from previous version.

---

### 3. Update Module (For Saving)

**Endpoint:** `PUT /v2/admin/module/{moduleId}/update-enhanced`

**Authentication:** Required (Bearer token)

**Description:** Save complete quiz data including encrypted answers/explanations.

**Note:** This endpoint already exists and works as-is.

---

## 📥 Request/Response Formats

### Import API - Request

**URL:** `POST /v2/admin/module/{moduleId}/quiz/import`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Path Parameters:**
- `moduleId` (integer, required) - Module ID

**Request Body:**
```json
{
  "quiz_data": {
    "quiz": [
      {
        "question": "What is 2+2?",
        "question_html": "<p>What is 2+2?</p>",
        "options": ["2", "3", "4", "5"],
        "options_html": ["2", "3", "4", "5"],
        "points": 1
      }
    ],
    "metadata": {
      "time_limit": 30,
      "attempt_limit": 3
    }
  }
}
```

**Field Details:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `quiz_data.quiz` | array | ✅ Yes | Array of quiz questions |
| `quiz[].question` | string | ✅ Yes | Plain text question |
| `quiz[].question_html` | string | ❌ No | HTML formatted question (optional - if missing, backend stores same as `question`) |
| `quiz[].options` | array[string] | ✅ Yes | Plain text options array (minimum 2 items) |
| `quiz[].options_html` | array[string] | ❌ No | HTML formatted options array (optional - if missing, backend stores same as `options`) |
| `quiz[].points` | integer | ❌ No | Points for question (defaults to 1 if not provided) |
| `quiz[].question_latex` | string | ❌ No | LaTeX question (optional, for backward compatibility) |
| `quiz[].explanation_latex` | string | ❌ No | LaTeX explanation (optional, for backward compatibility) |
| `quiz_data.metadata.time_limit` | integer | ❌ No | Time limit in minutes |
| `quiz_data.metadata.attempt_limit` | integer | ❌ No | Maximum attempts allowed |

**Minimal Request (What Admins Will Actually Upload):**
```json
{
  "quiz_data": {
    "quiz": [
      {
        "question": "What is 2+2?",
        "options": ["2", "3", "4", "5"],
        "points": 1
      }
    ]
  }
}
```

**Important Notes:**
- ❌ **NO** `correct_answer` field
- ❌ **NO** `explanation` field
- ❌ **NO** `explanation_html` field
- ❌ **NO** `merge_mode` parameter (always replaces)
- ✅ `question_html` and `options_html` are optional
- ✅ If HTML fields not provided, backend stores plain text in both fields

### Import API - Response

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "imported_count": 3,
    "total_questions": 3,
    "module_id": 123,
    "message": "Quiz imported successfully"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on success |
| `data.imported_count` | integer | Number of questions imported |
| `data.total_questions` | integer | Total questions in module after import |
| `data.module_id` | integer | Module ID |
| `data.message` | string | Success message |

---

## ❌ Error Handling

### Error Response Format

All errors follow this structure:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "data": null,
  "details": {
    "field_name": "Specific error message"
  }
}
```

### Error Codes & Messages

#### 1. Validation Errors (422)

**Missing Required Fields:**
```json
{
  "success": false,
  "error": "Invalid quiz JSON format",
  "code": "VALIDATION_ERROR",
  "data": null,
  "details": {
    "quiz[0].question": "Question is required",
    "quiz[0].options": "At least 2 options are required"
  }
}
```

**Invalid Options:**
```json
{
  "success": false,
  "error": "Invalid quiz JSON format",
  "code": "VALIDATION_ERROR",
  "data": null,
  "details": {
    "quiz[0].options": "At least 2 options are required"
  }
}
```

**Invalid HTML Fields:**
```json
{
  "success": false,
  "error": "Invalid quiz JSON format",
  "code": "VALIDATION_ERROR",
  "data": null,
  "details": {
    "quiz[0].options_html": "options_html array length must match options array length"
  }
}
```

**Invalid Points:**
```json
{
  "success": false,
  "error": "Invalid quiz JSON format",
  "code": "VALIDATION_ERROR",
  "data": null,
  "details": {
    "quiz[0].points": "Points must be non-negative"
  }
}
```

#### 2. Module Not Found (404)

```json
{
  "success": false,
  "error": "Module not found",
  "code": "MODULE_NOT_FOUND",
  "data": null
}
```

#### 3. Invalid Module Category (422)

```json
{
  "success": false,
  "error": "Module is not a quiz",
  "code": "INVALID_MODULE_CATEGORY",
  "data": null,
  "details": {
    "category": "Module must be of type QUIZ"
  }
}
```

#### 4. Invalid JSON Format (422)

```json
{
  "success": false,
  "error": "Invalid quiz JSON format",
  "code": "QUIZ_INVALID_JSON",
  "data": null,
  "details": {
    "quiz": "Quiz data must contain a quiz array"
  }
}
```

#### 5. Missing Quiz Data (422)

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "data": null,
  "details": {
    "quiz_data": "Quiz data is required"
  }
}
```

#### 6. Server Error (500)

```json
{
  "success": false,
  "error": "Failed to import quiz",
  "code": "INTERNAL_SERVER_ERROR",
  "data": null
}
```

### Error Handling Best Practices

1. **Check `success` field first**
2. **Display user-friendly messages** from `error` field
3. **Show field-specific errors** from `details` object
4. **Handle network errors** separately
5. **Log error codes** for debugging

---

## 🔧 Integration Steps

### Step 1: Update Import Handler

**File:** `components/course/ModuleEditor/forms/QuizModuleForm.tsx`

**Before (Current):**
```typescript
const handleImportJSON = async () => {
  // ... file reading ...
  const encryptedQuiz = {
    quiz: quizData.quiz.map((q) => ({
      question: q.question,
      question_html: q.question_html || q.question,
      options: q.options,
      options_html: q.options_html || q.options,
      answer: encryptString(q.correct_answer, secretKey), // ❌ Remove
      correct_answer: encryptString(q.correct_answer, secretKey), // ❌ Remove
      explanation: safeEncrypt(q.explanation, secretKey), // ❌ Remove
      explanation_html: safeEncrypt(q.explanation_html, secretKey), // ❌ Remove
      points: q.points || 1,
    })),
  };
  await importQuiz.mutateAsync({
    quizData: encryptedQuiz,
    mergeMode: "replace",
  });
};
```

**After (New):**
```typescript
const handleImportJSON = async () => {
  // ... file reading ...
  const quizDataToImport = {
    quiz: quizData.quiz.map((q) => ({
      question: q.question, // Plain text (required)
      question_html: q.question_html, // Optional - only send if provided
      options: q.options, // Plain text array (required)
      options_html: q.options_html, // Optional - only send if provided
      points: q.points || 1,
      // ✅ No answers/explanations - admin will select in UI
    })),
  };
  await importQuiz.mutateAsync({
    quizData: quizDataToImport,
    // ✅ No mergeMode - backend always replaces
  });
};
```

### Step 2: Ensure QuizBuilder Handles Missing Answers

**File:** `components/course/ModuleEditor/forms/QuizBuilder.tsx`

**Check:**
- QuizBuilder should handle questions without `correct_answer` gracefully
- Display questions with empty answer selection (already works)
- Radio buttons should work for selecting answers

**No changes needed** if QuizBuilder already handles missing answers.

### Step 3: Keep Save Flow Unchanged

**File:** `components/course/ModuleEditor/forms/QuizModuleForm.tsx`

**Current Save Flow (Keep As-Is):**
```typescript
const handleSubmit = async () => {
  // ... collect quiz data ...
  const encryptedQuiz = {
    quiz: quizData.quiz.map((q) => ({
      // ... all fields ...
      answer: encryptString(q.correct_answer, secretKey),
      correct_answer: encryptString(q.correct_answer, secretKey),
      explanation: safeEncrypt(q.explanation, secretKey),
      explanation_html: safeEncrypt(q.explanation_html, secretKey),
    })),
  };
  await updateModule.mutateAsync({
    moduleId: editingModuleId,
    data: {
      data: {
        category: 'QUIZ',
        quiz: encryptedQuiz.quiz,
      },
    },
  });
};
```

**No changes needed** - save flow remains the same.

---

## 💻 Code Examples

### Complete Import Flow Example

```typescript
// components/course/ModuleEditor/forms/QuizModuleForm.tsx

const handleImportJSON = async () => {
  try {
    // 1. Read JSON file
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const text = await file.text();
      const quizData = JSON.parse(text);
      
      // 2. Validate structure (client-side)
      if (!quizData.quiz || !Array.isArray(quizData.quiz)) {
        toast.error('Invalid JSON format: quiz array is required');
        return;
      }
      
      // 3. Prepare import data (no encryption)
      const quizDataToImport = {
        quiz: quizData.quiz.map((q) => ({
          question: q.question,
          question_html: q.question_html, // Optional
          options: q.options,
          options_html: q.options_html, // Optional
          points: q.points || 1,
        })),
        metadata: quizData.metadata, // Optional
      };
      
      // 4. Call import API
      const result = await importQuiz.mutateAsync({
        quizData: quizDataToImport,
      });
      
      if (result.success) {
        toast.success(`Imported ${result.data.imported_count} questions`);
        // 5. Refetch module data to show imported questions
        await refetchModule();
        // Modal stays open - questions appear in QuizBuilder
      }
    };
    
    fileInput.click();
  } catch (error) {
    console.error('Import error:', error);
    toast.error('Failed to import quiz');
  }
};
```

### Error Handling Example

```typescript
try {
  const result = await importQuiz.mutateAsync({ quizData });
  
  if (!result.success) {
    // Handle validation errors
    if (result.code === 'VALIDATION_ERROR' && result.details) {
      const errorMessages = Object.entries(result.details)
        .map(([field, message]) => `${field}: ${message}`)
        .join('\n');
      toast.error(`Validation errors:\n${errorMessages}`);
    } else {
      toast.error(result.error || 'Failed to import quiz');
    }
    return;
  }
  
  toast.success('Quiz imported successfully');
} catch (error) {
  // Handle network errors
  if (error.response?.status === 404) {
    toast.error('Module not found');
  } else if (error.response?.status === 401) {
    toast.error('Unauthorized - please login again');
  } else {
    toast.error('Network error - please try again');
  }
}
```

### Save Flow Example (Unchanged)

```typescript
const handleSave = async () => {
  try {
    // Collect quiz data from QuizBuilder
    const quizData = questions.map((q) => ({
      question: q.question,
      question_html: q.question_html,
      options: q.options,
      options_html: q.options_html,
      correct_answer: q.correct_answer, // Selected by admin
      explanation: q.explanation, // Added by admin
      explanation_html: q.explanation_html,
      points: q.points,
    }));
    
    // Encrypt answers and explanations
    const encryptedQuiz = {
      quiz: quizData.map((q) => ({
        ...q,
        answer: encryptString(q.correct_answer, secretKey),
        correct_answer: encryptString(q.correct_answer, secretKey),
        explanation: safeEncrypt(q.explanation, secretKey),
        explanation_html: safeEncrypt(q.explanation_html, secretKey),
      })),
    };
    
    // Save via update-enhanced API
    await updateModule.mutateAsync({
      moduleId: editingModuleId,
      data: {
        data: {
          category: 'QUIZ',
          quiz: encryptedQuiz.quiz,
        },
      },
    });
    
    toast.success('Quiz saved successfully');
    onClose(); // Close modal
  } catch (error) {
    toast.error('Failed to save quiz');
  }
};
```

---

## 📄 JSON Template Handling

### Is JSON Template Handled on Frontend?

**Yes!** The JSON template/format is handled entirely on the frontend:

1. **File Reading**: Frontend reads the JSON file using FileReader API
2. **Parsing**: Frontend parses JSON using `JSON.parse()`
3. **Validation**: Frontend can do client-side validation (optional but recommended)
4. **Transformation**: Frontend transforms data before sending to backend
5. **Error Handling**: Frontend handles file reading/parsing errors

### JSON Template Structure

**Minimal Template (Recommended for Admins):**
```json
{
  "quiz": [
    {
      "question": "What is 2+2?",
      "options": ["2", "3", "4", "5"],
      "points": 1
    },
    {
      "question": "What is the capital of France?",
      "options": ["Paris", "London", "Berlin", "Madrid"],
      "points": 1
    }
  ],
  "metadata": {
    "time_limit": 30,
    "attempt_limit": 3
  }
}
```

**With HTML Fields (Optional):**
```json
{
  "quiz": [
    {
      "question": "What is 2+2?",
      "question_html": "<p>What is <strong>2+2</strong>?</p>",
      "options": ["2", "3", "4", "5"],
      "options_html": ["2", "3", "4", "5"],
      "points": 1
    }
  ]
}
```

### Frontend JSON Validation

```typescript
const validateQuizJSON = (quizData: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!quizData.quiz || !Array.isArray(quizData.quiz)) {
    errors.push('Quiz data must contain a quiz array');
    return { valid: false, errors };
  }
  
  quizData.quiz.forEach((q: any, index: number) => {
    if (!q.question) {
      errors.push(`Question ${index + 1}: question is required`);
    }
    if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
      errors.push(`Question ${index + 1}: at least 2 options are required`);
    }
    if (q.options_html && q.options && q.options.length !== q.options_html.length) {
      errors.push(`Question ${index + 1}: options_html length must match options length`);
    }
  });
  
  return { valid: errors.length === 0, errors };
};
```

---

## ✅ Testing Checklist

### Import Testing

- [ ] Import with minimal JSON (question + options only)
- [ ] Import with HTML fields
- [ ] Import with metadata (time_limit, attempt_limit)
- [ ] Import with points specified
- [ ] Import without points (should default to 1)
- [ ] Import replaces existing questions
- [ ] Error handling: missing question
- [ ] Error handling: missing options
- [ ] Error handling: less than 2 options
- [ ] Error handling: invalid module ID
- [ ] Error handling: non-quiz module
- [ ] Error handling: invalid JSON format
- [ ] Error handling: network errors

### UI Testing

- [ ] Imported questions appear in QuizBuilder
- [ ] Modal stays open after import
- [ ] Questions display with plain text
- [ ] Radio buttons work for answer selection
- [ ] Explanation editor works
- [ ] Points can be edited
- [ ] Questions can be reordered
- [ ] Questions can be deleted

### Save Testing

- [ ] Save with selected answers
- [ ] Save with explanations
- [ ] Save without explanations
- [ ] Save encrypts answers correctly
- [ ] Save encrypts explanations correctly
- [ ] Save updates module successfully

### Integration Testing

- [ ] Full workflow: Import → Select Answers → Save
- [ ] Export after import (should include answers if saved)
- [ ] Export before save (should not include answers)
- [ ] Re-import exported file (should work)

---

## 📞 Support

If you encounter any issues or need clarification:

1. Check error messages in response
2. Verify request format matches documentation
3. Check network tab for actual request/response
4. Contact backend team with error codes

---

**Last Updated:** January 2026  
**Status:** ✅ Production Ready  
**API Version:** V2
