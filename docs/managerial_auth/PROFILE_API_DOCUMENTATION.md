# Managerial Profile API Documentation

## Overview
These APIs allow authenticated managerial users to get and update their profile information in the `managerial_auth` table.

---

## 1. Get User Profile

### Endpoint
```
GET /admin/auth/getProfile
```

### Authentication
**Required** - Bearer Token in Authorization header

### Headers
| Header | Value | Required |
|---|---|---|
| `Authorization` | `Bearer <JWT_TOKEN>` | Yes |
| `Content-Type` | `application/json` | No |

### Request Body
```json
{}
```
**Note:** The user ID is automatically extracted from the JWT token by the `authenticateUser` middleware.

### Success Response (200)
```json
{
  "success": true,
  "rows": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+880123456789",
      "role": "admin",
      "profile": {
        "facebookId": "john.fb",
        "address": "Dhaka, Bangladesh",
        "schoolCollege": "Dhaka College",
        "group": "Science",
        "guardianName": "Abdul Karim",
        "guardianMobile": "01712345678",
        "relationWithGuardian": "Father",
        "gender": "Male",
        "classLevel": "HSC",
        "version": "Bangla"
      },
      "is_verified": true,
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### Error Response (400)
```json
{
  "success": false,
  "error": "Database error occurred"
}
```

### Error Response (401)
```json
{
  "success": false,
  "error": "Token is required"
}
```

### Response Fields
| Field | Type | Description |
|---|---|---|
| `success` | boolean | Whether the request was successful |
| `rows` | array | Array containing user profile data |
| `rows[0].id` | integer | User ID |
| `rows[0].name` | string | Full name |
| `rows[0].email` | string | Email address |
| `rows[0].phone` | string | Phone number |
| `rows[0].role` | string | User role (admin, moderator, etc.) |
| `rows[0].profile` | object | Structured JSON object storing profile data |
| `rows[0].is_verified` | boolean | Account verification status |
| `rows[0].created_at` | string | Account creation timestamp |

---

## 2. Update User Profile

### Endpoint
```
PUT /admin/auth/setProfile
```

### Authentication
**Required** - Bearer Token in Authorization header

### Headers
| Header | Value | Required |
|---|---|---|
| `Authorization` | `Bearer <JWT_TOKEN>` | Yes |
| `Content-Type` | `application/json` | Yes |

### Request Body
```json
{
  "name": "John Doe",
  "profile": {
    "facebookId": "john.fb",
    "address": "Dhaka, Bangladesh",
    "schoolCollege": "Dhaka College",
    "group": "Science",
    "guardianName": "Abdul Karim",
    "guardianMobile": "01712345678",
    "relationWithGuardian": "Father",
    "gender": "Male",
    "classLevel": "HSC",
    "version": "Bangla"
  }
}
```

### Request Fields
| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Full name of the user |
| `profile` | object | Yes | JSON object for structured profile data. Can contain any properties your app needs |

### Success Response (200)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "rowCount": 1
}
```

### Error Response (400) - Validation Error
```json
{
  "success": false,
  "error": "Missing required field: name"
}
```

### Error Response (400) - Database Error
```json
{
  "success": false,
  "error": "Database error occurred"
}
```

### Error Response (401) - Unauthorized
```json
{
  "success": false,
  "error": "Token is required"
}
```

### Response Fields
| Field | Type | Description |
|---|---|---|
| `success` | boolean | Whether the update was successful |
| `message` | string | Success message |
| `rowCount` | integer | Number of rows affected (should be 1) |

---

## Error Codes

| Status Code | Meaning | When it Occurs |
|---|---|---|
| 200 | OK | Request successful |
| 400 | Bad Request | Validation error or database error |
| 401 | Unauthorized | Missing or invalid JWT token |
| 500 | Internal Server Error | Server-side error |

---

## Common Error Messages

| Error | Cause | Solution |
|---|---|---|
| "Token is required" | No Authorization header provided | Add `Authorization: Bearer <token>` header |
| "Missing required field: name" | `name` field not provided in request body | Include `name` in request body |
| "Database error occurred" | Query execution failed | Check request data format and database connectivity |

---

## Example Usage

### Using Fetch API

#### Get Profile
```javascript
const token = 'your_jwt_token_here';

fetch('/admin/auth/getProfile', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const profile = data.rows[0];
    console.log('Name:', profile.name);
    console.log('Profile Data:', profile.profile);
  } else {
    console.error('Error:', data.error);
  }
})
.catch(error => console.error('Fetch Error:', error));
```

#### Update Profile
```javascript
const token = 'your_jwt_token_here';

const updateData = {
  name: "Jane Doe",
  profile: {
    facebookId: "jane.fb",
    address: "Dhaka, Bangladesh",
    schoolCollege: "Dhaka College",
    group: "Science",
    guardianName: "Abdul Karim",
    guardianMobile: "01712345678",
    relationWithGuardian: "Father",
    gender: "Female",
    classLevel: "HSC",
    version: "Bangla"
  }
};

fetch('/admin/auth/setProfile', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(updateData)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Profile updated successfully');
  } else {
    console.error('Error:', data.error);
  }
})
.catch(error => console.error('Fetch Error:', error));
```

### Using Axios

#### Get Profile
```javascript
import axios from 'axios';

const token = 'your_jwt_token_here';

axios.get('/admin/auth/getProfile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => {
  if (response.data.success) {
    const profile = response.data.rows[0];
    console.log('Profile:', profile);
  }
})
.catch(error => console.error('Error:', error.response?.data));
```

#### Update Profile
```javascript
import axios from 'axios';

const token = 'your_jwt_token_here';

const updateData = {
  name: "Jane Doe",
  profile: {
    facebookId: "jane.fb",
    address: "Dhaka, Bangladesh",
    schoolCollege: "Dhaka College",
    group: "Science",
    guardianName: "Abdul Karim",
    guardianMobile: "01712345678",
    relationWithGuardian: "Father",
    gender: "Female",
    classLevel: "HSC",
    version: "Bangla"
  }
};

axios.put('/admin/auth/setProfile', updateData, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => {
  if (response.data.success) {
    console.log('Profile updated successfully');
  }
})
.catch(error => console.error('Error:', error.response?.data));
```

---

## Notes for Frontend Developers

1. **Authentication Required**: Both endpoints require a valid JWT token. Ensure the token is stored securely and included in all requests.

2. **Profile JSON Structure**: The `profile` field now has fixed keys for student identity and guardian details, but it still accepts additional custom properties.

3. **User ID Auto-Injection**: The user ID is automatically extracted from the JWT token, so you don't need to send it in the request body.

4. **Always Check Success Flag**: Always check the `success` field in the response to determine if the request succeeded.

5. **CORS**: Ensure your frontend is configured to handle CORS if making requests from a different origin.

6. **Token Expiration**: Implement token refresh logic to handle expired tokens gracefully.

7. **Error Handling**: Implement proper error handling and user feedback for various error scenarios.

---

## Backend Implementation Details

**Database**: `managerial_auth` table
**Service**: `AuthService.getProfile()` and `AuthService.setProfile()`
**Controller**: `AuthController.getProfile()` and `AuthController.setProfile()`
**Middleware**: `authenticateUser` - validates JWT and sets user_id in request body
