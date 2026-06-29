/**
 * Enhanced Teacher Service V2
 * Supports enhanced teacher profiles with new fields and better APIs
 */

const TeacherService = require('./teacher').TeacherService;
const ErrorHandler = require('../../util/errorHandler');
const bcrypt = require('bcryptjs');
const { managerialAccountTypes } = require('../../util/constants');
const MessagingService = require('../../service/messagingService').MessagingService;
const RoleService = require('./roleService').RoleService;
const AdminService = require('./admin').AdminService;
const { createTtlCache } = require('../../util/ttlCache');

const messagingService = new MessagingService();
const roleService = new RoleService();
const adminService = new AdminService();
const publicInstructorCache = createTtlCache(15000);

class TeacherServiceV2 extends TeacherService {
    constructor() {
        super();
    }

    /**
     * Get all teachers (just names) - simple list
     * Returns all teachers regardless of course/bundle associations
     * Teachers are platform-wide entities
     * @returns {Promise<object>} List of teachers with just names
     */
    async listNames() {
        try {
            // Get all teachers - they can exist without courses/bundles
            const query = `
                SELECT DISTINCT id, name 
                FROM managerial_auth 
                WHERE type IN (1, 2)
                   OR (profile->>'category' = 'instructor' OR profile->>'category' = 'teacher')
                ORDER BY name ASC
            `;
            const result = await this.query(query, []);

            if (result.success) {
                return {
                    success: true,
                    data: result.data.map(teacher => ({
                        id: teacher.id,
                        name: teacher.name
                    }))
                };
            }

            return result;
        } catch (error) {
            console.error('Error listing teacher names:', error);
            return {
                success: false,
                error: 'Failed to list teachers',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Get full teacher information with all enhanced fields
     * Teachers are platform-wide - they can exist without courses/bundles
     * @param {number} teacherId - Teacher ID
     * @returns {Promise<object>} Full teacher data
     */
    async getTeacherFull(teacherId) {
        try {
            // Get teacher from managerial_auth - teachers exist independently
            const query = `
                SELECT 
                    id,
                    name,
                    login,
                    type,
                    profile,
                    created_at,
                    updated_at
                FROM managerial_auth 
                WHERE id = $1
            `;
            const result = await this.query(query, [teacherId]);

            if (!result.success || result.data.length === 0) {
                return {
                    success: false,
                    error: 'Teacher not found',
                    code: 'TEACHER_NOT_FOUND'
                };
            }

            const teacher = result.data[0];
            const profile = teacher.profile || {};

            // Get courses teaching (if any) - optional association
            const coursesQuery = `
                SELECT c.id, c.title, c.url, c.price
                FROM course c
                INNER JOIN instructor i ON c.id = i.course_id
                WHERE i.user_id = $1
                ORDER BY c.title ASC
            `;
            const coursesResult = await this.query(coursesQuery, [teacherId]);

            // Format response with enhanced fields
            const teacherFull = {
                id: teacher.id,
                name: teacher.name,
                role: profile.role || null,
                university: profile.university || null,
                bio: profile.bio || null,
                image: profile.image || null,
                achievements: profile.achievements || [],
                social: profile.social || {},
                courses_teaching: coursesResult.success ? coursesResult.data.map(c => c.id) : [],
                courses_teaching_details: coursesResult.success ? coursesResult.data : [],
                category: profile.category || 'instructor',
                isActive: profile.isActive !== undefined ? profile.isActive : true,
                login: teacher.login,
                created_at: teacher.created_at,
                updated_at: teacher.updated_at
            };

            return {
                success: true,
                data: teacherFull
            };
        } catch (error) {
            console.error('Error getting teacher full:', error);
            return {
                success: false,
                error: 'Failed to get teacher',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Get teachers by course_id
     * @param {number} courseId - Course ID
     * @returns {Promise<object>} List of teachers teaching this course
     */
    async getTeachersByCourse(courseId) {
        try {
            // Verify course exists
            const courseQuery = `SELECT id FROM course WHERE id = $1`;
            const courseResult = await this.query(courseQuery, [courseId]);

            if (!courseResult.success || courseResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Course not found',
                    code: 'COURSE_NOT_FOUND'
                };
            }

            const query = `
                SELECT 
                    ma.id,
                    ma.name,
                    ma.login,
                    ma.type,
                    ma.profile,
                    ma.created_at,
                    ma.updated_at
                FROM managerial_auth ma
                INNER JOIN instructor i ON ma.id = i.user_id
                WHERE i.course_id = $1
                ORDER BY ma.name ASC
            `;
            const result = await this.query(query, [courseId]);

            if (result.success) {
                const teachers = await Promise.all(
                    result.data.map(async (teacher) => {
                        const profile = teacher.profile || {};
                        return {
                            id: teacher.id,
                            name: teacher.name,
                            role: profile.role || null,
                            university: profile.university || null,
                            bio: profile.bio || null,
                            image: profile.image || null,
                            achievements: profile.achievements || [],
                            social: profile.social || {},
                            category: profile.category || 'instructor',
                            isActive: profile.isActive !== undefined ? profile.isActive : true
                        };
                    })
                );

                return {
                    success: true,
                    data: teachers
                };
            }

            return result;
        } catch (error) {
            console.error('Error getting teachers by course:', error);
            return {
                success: false,
                error: 'Failed to get teachers',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Create teacher with enhanced fields and isPrivileged flag
     * @param {object} teacherData - Teacher data
     * @returns {Promise<object>} Creation result
     */
    async createEnhanced(teacherData) {
        try {
            // Validate required fields
            if (!teacherData.name) {
                return {
                    success: false,
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: {
                        name: 'Name is required'
                    }
                };
            }

            if (!teacherData.login) {
                return {
                    success: false,
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: {
                        login: 'Login (phone/email) is required'
                    }
                };
            }

            // Check if login already exists
            const existingQuery = `SELECT id FROM managerial_auth WHERE login = $1`;
            const existingResult = await this.query(existingQuery, [teacherData.login]);

            if (existingResult.success && existingResult.data.length > 0) {
                return {
                    success: false,
                    error: 'Login already exists',
                    code: 'DUPLICATE_LOGIN',
                    details: {
                        login: 'A user with this login already exists'
                    }
                };
            }

            // Prepare profile data
            const profile = {
                role: teacherData.role || null,
                university: teacherData.university || null,
                bio: teacherData.bio || null,
                image: teacherData.image || null,
                achievements: teacherData.achievements || [],
                social: teacherData.social || {},
                category: teacherData.category || 'instructor',
                isActive: teacherData.isActive !== undefined ? teacherData.isActive : true,
                selectedCourse: teacherData.courses_teaching || [] // Keep for backward compatibility
            };

            // Teachers are platform-wide. Admin panel access is derived from account type.
            const hasAdminPanelAccess = teacherData.isPrivileged === true;
            const userType = hasAdminPanelAccess ? managerialAccountTypes.moderator : managerialAccountTypes.regular;

            // Always generate password (required by database NOT NULL constraint)
            // For non-privileged teachers, password is generated but not sent via SMS
            const password = this.getRandomPin('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Keep email/phone in sync with login (auth uses login; email/phone used for notifications and consistency)
            const loginIsEmail = teacherData.login && teacherData.login.indexOf('@') !== -1;
            const emailFromLogin = loginIsEmail ? teacherData.login : null;
            const phoneFromLogin = loginIsEmail ? null : teacherData.login;

            // Insert teacher
            const insertQuery = `
                INSERT INTO managerial_auth (
                    name, type, login, email, phone, profile, password
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, name, login, type
            `;
            const insertResult = await this.query(insertQuery, [
                teacherData.name,
                userType,
                teacherData.login,
                emailFromLogin,
                phoneFromLogin,
                JSON.stringify(profile),
                hashedPassword
            ]);

            if (!insertResult.success) {
                return {
                    success: false,
                    error: 'Failed to create teacher',
                    code: 'CREATION_FAILED'
                };
            }

            const teacherId = insertResult.data[0].id;

            // Link to courses if provided (optional - teachers can exist without courses)
            if (teacherData.courses_teaching && Array.isArray(teacherData.courses_teaching) && teacherData.courses_teaching.length > 0) {
                // Validate courses exist using parameterized query
                const placeholders = teacherData.courses_teaching.map((_, i) => `$${i + 1}`).join(',');
                const validateCoursesQuery = `SELECT id FROM course WHERE id IN (${placeholders})`;
                const validateResult = await this.query(validateCoursesQuery, teacherData.courses_teaching);
                
                if (validateResult.success && validateResult.data.length === teacherData.courses_teaching.length) {
                    // Insert using parameterized query
                    const insertPromises = teacherData.courses_teaching.map(courseId => 
                        this.query(`INSERT INTO instructor(user_id, course_id) VALUES ($1, $2)`, [teacherId, courseId])
                    );
                    await Promise.all(insertPromises);
                }
            }

            // Send credentials only if privileged
            if (hasAdminPanelAccess && password) {
                const text = `Dear ${teacherData.name}, your login credentials for https://teachers.mathpro.com is, login:${teacherData.login} and password:${password}`;
                await messagingService.sendMessage(teacherData.login, text);
            }

            return {
                success: true,
                data: {
                    id: teacherId,
                    name: teacherData.name,
                    login: teacherData.login,
                    credentials_sent: hasAdminPanelAccess,
                    message: hasAdminPanelAccess 
                        ? 'Teacher created with admin panel access. Credentials sent via SMS.'
                        : 'Teacher created without admin panel access.'
                }
            };
        } catch (error) {
            console.error('Error creating teacher:', error);
            return {
                success: false,
                error: 'Failed to create teacher',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Update teacher with enhanced fields
     * @param {number} teacherId - Teacher ID
     * @param {object} teacherData - Updated teacher data
     * @param {number} [updatedBy] - ID of admin performing the update (for role audit)
     * @returns {Promise<object>} Update result
     */
    async updateEnhanced(teacherId, teacherData, updatedBy) {
        try {
            // Verify teacher exists and load fields needed for grant/revoke (email, phone, name, login)
            const existingQuery = `SELECT id, type, profile, name, login, email, phone FROM managerial_auth WHERE id = $1`;
            const existingResult = await this.query(existingQuery, [teacherId]);

            if (!existingResult.success || existingResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Teacher not found',
                    code: 'TEACHER_NOT_FOUND'
                };
            }

            const existing = existingResult.data[0];
            const currentProfile = existing.profile || {};

            // Build update query
            const updateFields = [];
            const updateParams = [];
            let paramIndex = 1;

            if (teacherData.name !== undefined) {
                updateFields.push(`name = $${paramIndex}`);
                updateParams.push(teacherData.name);
                paramIndex++;
            }

            if (teacherData.login !== undefined) {
                // Check if new login already exists (excluding current teacher)
                const loginCheckQuery = `SELECT id FROM managerial_auth WHERE login = $1 AND id != $2`;
                const loginCheckResult = await this.query(loginCheckQuery, [teacherData.login, teacherId]);

                if (loginCheckResult.success && loginCheckResult.data.length > 0) {
                    return {
                        success: false,
                        error: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: {
                            login: 'Login already exists'
                        }
                    };
                }

                updateFields.push(`login = $${paramIndex}`);
                updateParams.push(teacherData.login);
                paramIndex++;
            }

            // Keep email/phone in sync with login when missing (auth uses login; email/phone used for notifications)
            const effectiveLogin = (teacherData.login !== undefined ? teacherData.login : existing.login) || null;
            if (effectiveLogin && effectiveLogin.trim()) {
                const trimmedLogin = effectiveLogin.trim();
                const loginIsEmail = trimmedLogin.indexOf('@') !== -1;
                const emailMissing = !(existing.email && existing.email.trim());
                const phoneMissing = !(existing.phone && existing.phone.trim());
                const loginUpdated = teacherData.login !== undefined;
                if (loginIsEmail && (emailMissing || loginUpdated) && teacherData.email === undefined) {
                    updateFields.push(`email = $${paramIndex}`);
                    updateParams.push(trimmedLogin);
                    paramIndex++;
                } else if (!loginIsEmail && (phoneMissing || loginUpdated) && teacherData.phone === undefined) {
                    updateFields.push(`phone = $${paramIndex}`);
                    updateParams.push(trimmedLogin);
                    paramIndex++;
                }
            }

            // Handle admin panel access using account type and roles.
            if (teacherData.isPrivileged !== undefined) {
                const newIsPrivileged = teacherData.isPrivileged === true;
                const currentIsPrivileged = existing.type !== managerialAccountTypes.regular;

                const teacherRoleResult = await roleService.getRoleIdByName('teacher');
                const teacherRoleId = teacherRoleResult.success && teacherRoleResult.data ? teacherRoleResult.data : null;

                if (newIsPrivileged && !currentIsPrivileged) {
                    // Granting: require email so we can send credentials using the same template as admin.
                    // Auth uses the login field (email or phone); derive email from existing.email or from login when it looks like email.
                    const loginVal = (existing.login && existing.login.trim()) ? existing.login.trim() : null;
                    const hasAt = loginVal && loginVal.indexOf('@') !== -1;
                    const teacherEmail = (existing.email && existing.email.trim())
                        ? existing.email.trim()
                        : (hasAt ? loginVal : null);
                    const teacherPhone = (existing.phone && existing.phone.trim())
                        ? existing.phone.trim()
                        : (loginVal && !hasAt ? loginVal : null);
                    if (!teacherEmail && !teacherPhone) {
                        return {
                            success: false,
                            error: 'Email or phone is required to grant admin panel access so we can send credentials.',
                            code: 'VALIDATION_ERROR',
                            details: { email: 'Email or phone is required to grant admin panel access.' }
                        };
                    }
                    if (!teacherEmail) {
                        return {
                            success: false,
                            error: 'Email is required to grant admin panel access so we can send credentials by email. Use an email in the login field or set email.',
                            code: 'VALIDATION_ERROR',
                            details: { email: 'Email is required to send credentials using the admin email template.' }
                        };
                    }

                    // Set type=1 (admin); do not generate or update password
                    updateFields.push(`type = $${paramIndex}`);
                    updateParams.push(managerialAccountTypes.admin);
                    paramIndex++;

                    if (teacherRoleId) {
                        const assignResult = await roleService.assignRole(teacherId, teacherRoleId, updatedBy);
                        if (!assignResult.success && assignResult.error !== 'User already has this role') {
                            return {
                                success: false,
                                error: assignResult.error || 'Failed to assign teacher role',
                                code: 'ROLE_ASSIGN_FAILED'
                            };
                        }
                    }

                    // Send credentials using same template as admin (password placeholder: we do not store plaintext)
                    const teacherName = teacherData.name || existing.name;
                    const teacherLogin = teacherData.login || existing.login;
                    await adminService.sendAdminCredentialsEmail(teacherEmail, teacherName, teacherLogin, 'Use your existing password');
                } else if (!newIsPrivileged && currentIsPrivileged) {
                    // Revoking: remove teacher role and set type=3 (regular)
                    if (teacherRoleId) {
                        await roleService.removeRole(teacherId, teacherRoleId, updatedBy);
                    }
                    updateFields.push(`type = $${paramIndex}`);
                    updateParams.push(managerialAccountTypes.regular);
                    paramIndex++;
                }
            }

            // Update profile
            const updatedProfile = {
                ...currentProfile,
                role: teacherData.role !== undefined ? teacherData.role : currentProfile.role,
                university: teacherData.university !== undefined ? teacherData.university : currentProfile.university,
                bio: teacherData.bio !== undefined ? teacherData.bio : currentProfile.bio,
                image: teacherData.image !== undefined ? teacherData.image : currentProfile.image,
                achievements: teacherData.achievements !== undefined ? teacherData.achievements : currentProfile.achievements,
                social: teacherData.social !== undefined ? teacherData.social : currentProfile.social,
                category: teacherData.category !== undefined ? teacherData.category : (currentProfile.category || 'instructor'),
                isActive: teacherData.isActive !== undefined ? teacherData.isActive : (currentProfile.isActive !== undefined ? currentProfile.isActive : true)
            };

            updateFields.push(`profile = $${paramIndex}`);
            updateParams.push(JSON.stringify(updatedProfile));
            paramIndex++;

            // Update teacher
            if (updateFields.length > 0) {
                updateParams.push(teacherId);
                const updateQuery = `
                    UPDATE managerial_auth 
                    SET ${updateFields.join(', ')}
                    WHERE id = $${paramIndex}
                    RETURNING id, name, login, type
                `;
                const updateResult = await this.query(updateQuery, updateParams);

                if (!updateResult.success) {
                    return {
                        success: false,
                        error: 'Failed to update teacher',
                        code: 'UPDATE_FAILED'
                    };
                }

                // Update course associations
                if (teacherData.courses_teaching !== undefined) {
                    // Delete existing
                    await this.query(`DELETE FROM instructor WHERE user_id = $1`, [teacherId]);

                    // Insert new using parameterized queries
                    if (Array.isArray(teacherData.courses_teaching) && teacherData.courses_teaching.length > 0) {
                        const insertPromises = teacherData.courses_teaching.map(courseId => 
                            this.query(`INSERT INTO instructor(user_id, course_id) VALUES ($1, $2)`, [teacherId, courseId])
                        );
                        await Promise.all(insertPromises);
                    }
                }

                return {
                    success: true,
                    data: {
                        id: teacherId,
                        ...updateResult.data[0],
                        message: 'Teacher updated successfully'
                    }
                };
            } else {
                return {
                    success: false,
                    error: 'No fields to update',
                    code: 'VALIDATION_ERROR',
                    details: {
                        body: 'At least one field must be provided for update'
                    }
                };
            }
        } catch (error) {
            console.error('Error updating teacher:', error);
            return {
                success: false,
                error: 'Failed to update teacher',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Get all teachers with full information
     * Returns all platform-wide teachers (can exist without courses/bundles)
     * @returns {Promise<object>} List of all teachers
     */
    async listFull() {
        try {
            // Get all teachers - platform-wide entities
            const query = `
                SELECT 
                    id,
                    name,
                    login,
                    type,
                    profile,
                    created_at,
                    updated_at
                FROM managerial_auth 
                WHERE type IN (1, 2)
                   OR (profile->>'category' = 'instructor' OR profile->>'category' = 'teacher')
                ORDER BY name ASC
            `;
            const result = await this.query(query, []);

            if (result.success) {
                const teachers = await Promise.all(
                    result.data.map(async (teacher) => {
                        const profile = teacher.profile || {};

                        // Get courses
                        const coursesQuery = `
                            SELECT c.id, c.title
                            FROM course c
                            INNER JOIN instructor i ON c.id = i.course_id
                            WHERE i.user_id = $1
                        `;
                        const coursesResult = await this.query(coursesQuery, [teacher.id]);

                        return {
                            id: teacher.id,
                            name: teacher.name,
                            role: profile.role || null,
                            university: profile.university || null,
                            bio: profile.bio || null,
                            image: profile.image || null,
                            achievements: profile.achievements || [],
                            social: profile.social || {},
                            courses_teaching: coursesResult.success ? coursesResult.data.map(c => c.id) : [],
                            category: profile.category || 'instructor',
                            isActive: profile.isActive !== undefined ? profile.isActive : true,
                            login: teacher.login,
                            created_at: teacher.created_at,
                            updated_at: teacher.updated_at
                        };
                    })
                );

                return {
                    success: true,
                    data: teachers
                };
            }

            return result;
        } catch (error) {
            console.error('Error listing teachers full:', error);
            return {
                success: false,
                error: 'Failed to list teachers',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Assign teacher to course
     * @param {number} teacherId - Teacher ID
     * @param {number} courseId - Course ID
     * @returns {Promise<object>} Assignment result
     */
    async assignToCourse(teacherId, courseId) {
        try {
            // Validate teacher exists
            const teacherCheck = await this.query('SELECT id FROM managerial_auth WHERE id = $1', [teacherId]);
            if (!teacherCheck.success || teacherCheck.data.length === 0) {
                return {
                    success: false,
                    error: 'Teacher not found',
                    code: 'TEACHER_NOT_FOUND'
                };
            }

            // Validate course exists
            const courseCheck = await this.query('SELECT id FROM course WHERE id = $1', [courseId]);
            if (!courseCheck.success || courseCheck.data.length === 0) {
                return {
                    success: false,
                    error: 'Course not found',
                    code: 'COURSE_NOT_FOUND'
                };
            }

            // Check if already assigned
            const existingCheck = await this.query(
                'SELECT id FROM instructor WHERE user_id = $1 AND course_id = $2',
                [teacherId, courseId]
            );

            if (existingCheck.success && existingCheck.data.length > 0) {
                return {
                    success: false,
                    error: 'Teacher is already assigned to this course',
                    code: 'ALREADY_ASSIGNED'
                };
            }

            // Assign
            const result = await this.query(
                'INSERT INTO instructor(user_id, course_id) VALUES ($1, $2) RETURNING id',
                [teacherId, courseId]
            );

            if (result.success) {
                return {
                    success: true,
                    data: {
                        teacher_id: teacherId,
                        course_id: courseId,
                        message: 'Teacher assigned to course successfully'
                    }
                };
            }

            return result;
        } catch (error) {
            console.error('Error assigning teacher to course:', error);
            return {
                success: false,
                error: 'Failed to assign teacher to course',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Remove teacher from course
     * @param {number} teacherId - Teacher ID
     * @param {number} courseId - Course ID
     * @returns {Promise<object>} Removal result
     */
    async removeFromCourse(teacherId, courseId) {
        try {
            const result = await this.query(
                'DELETE FROM instructor WHERE user_id = $1 AND course_id = $2 RETURNING id',
                [teacherId, courseId]
            );

            if (result.success && result.data.length > 0) {
                return {
                    success: true,
                    data: {
                        message: 'Teacher removed from course successfully'
                    }
                };
            }

            return {
                success: false,
                error: 'Assignment not found',
                code: 'ASSIGNMENT_NOT_FOUND'
            };
        } catch (error) {
            console.error('Error removing teacher from course:', error);
            return {
                success: false,
                error: 'Failed to remove teacher from course',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Get all courses for a teacher
     * @param {number} teacherId - Teacher ID
     * @returns {Promise<object>} List of courses
     */
    async getTeacherCourses(teacherId) {
        try {
            const query = `
                SELECT c.id, c.title, c.url, c.price, c.description
                FROM course c
                INNER JOIN instructor i ON c.id = i.course_id
                WHERE i.user_id = $1
                ORDER BY c.title ASC
            `;
            const result = await this.query(query, [teacherId]);

            if (result.success) {
                return {
                    success: true,
                    data: result.data
                };
            }

            return result;
        } catch (error) {
            console.error('Error getting teacher courses:', error);
            return {
                success: false,
                error: 'Failed to get teacher courses',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Search teachers with filters
     * @param {object} filters - Search filters
     * @returns {Promise<object>} Search results
     */
    async searchTeachers(filters) {
        try {
            let query = `
                SELECT 
                    id, name, login, type, profile, created_at, updated_at
                FROM managerial_auth
                WHERE 1=1
            `;
            const params = [];
            let paramIndex = 1;

            // Search term (name, role, university)
            if (filters.q) {
                query += ` AND (
                    LOWER(name) LIKE $${paramIndex} 
                    OR LOWER(profile->>'role') LIKE $${paramIndex}
                    OR LOWER(profile->>'university') LIKE $${paramIndex}
                )`;
                params.push(`%${filters.q.toLowerCase()}%`);
                paramIndex++;
            }

            // Category filter
            if (filters.category) {
                query += ` AND profile->>'category' = $${paramIndex}`;
                params.push(filters.category);
                paramIndex++;
            }

            // Active status filter
            if (filters.isActive !== undefined) {
                query += ` AND (profile->>'isActive')::boolean = $${paramIndex}`;
                params.push(filters.isActive);
                paramIndex++;
            }

            // Privilege status filter
            if (filters.isPrivileged !== undefined) {
                query += ` AND type ${filters.isPrivileged ? '!=' : '='} $${paramIndex}`;
                params.push(managerialAccountTypes.regular);
                paramIndex++;
            }

            // Has courses filter
            if (filters.hasCourses !== undefined) {
                if (filters.hasCourses) {
                    query += ` AND id IN (SELECT DISTINCT user_id FROM instructor)`;
                } else {
                    query += ` AND id NOT IN (SELECT DISTINCT user_id FROM instructor)`;
                }
            }

            query += ` ORDER BY name ASC`;

            // Pagination
            if (filters.limit) {
                query += ` LIMIT $${paramIndex}`;
                params.push(parseInt(filters.limit));
                paramIndex++;
            }

            if (filters.offset) {
                query += ` OFFSET $${paramIndex}`;
                params.push(parseInt(filters.offset));
            }

            const result = await this.query(query, params);

            if (result.success) {
                // Format response
                const formatted = await Promise.all(
                    result.data.map(async (teacher) => {
                        const profile = teacher.profile || {};
                        return {
                            id: teacher.id,
                            name: teacher.name,
                            login: teacher.login,
                            role: profile.role || null,
                            university: profile.university || null,
                            category: profile.category || 'instructor',
                            isActive: profile.isActive !== undefined ? profile.isActive : true
                        };
                    })
                );

                return {
                    success: true,
                    data: formatted,
                    count: formatted.length
                };
            }

            return result;
        } catch (error) {
            console.error('Error searching teachers:', error);
            return {
                success: false,
                error: 'Failed to search teachers',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Update teacher image
     * @param {number} teacherId - Teacher ID
     * @param {string} imageUrl - Image URL
     * @returns {Promise<object>} Update result
     */
    async updateTeacherImage(teacherId, imageUrl) {
        try {
            // Get current profile
            const teacherResult = await this.query(
                'SELECT profile FROM managerial_auth WHERE id = $1',
                [teacherId]
            );

            if (!teacherResult.success || teacherResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Teacher not found',
                    code: 'TEACHER_NOT_FOUND'
                };
            }

            const currentProfile = teacherResult.data[0].profile || {};
            currentProfile.image = imageUrl;

            // Update profile
            const updateResult = await this.query(
                'UPDATE managerial_auth SET profile = $1 WHERE id = $2 RETURNING id',
                [JSON.stringify(currentProfile), teacherId]
            );

            if (updateResult.success) {
                return {
                    success: true,
                    data: {
                        teacher_id: teacherId,
                        image: imageUrl,
                        message: 'Teacher image updated successfully'
                    }
                };
            }

            return updateResult;
        } catch (error) {
            console.error('Error updating teacher image:', error);
            return {
                success: false,
                error: 'Failed to update teacher image',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Delete teacher image
     * @param {number} teacherId - Teacher ID
     * @returns {Promise<object>} Deletion result
     */
    async deleteTeacherImage(teacherId) {
        try {
            // Get current profile
            const teacherResult = await this.query(
                'SELECT profile FROM managerial_auth WHERE id = $1',
                [teacherId]
            );

            if (!teacherResult.success || teacherResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Teacher not found',
                    code: 'TEACHER_NOT_FOUND'
                };
            }

            const currentProfile = teacherResult.data[0].profile || {};
            delete currentProfile.image;

            // Update profile
            const updateResult = await this.query(
                'UPDATE managerial_auth SET profile = $1 WHERE id = $2 RETURNING id',
                [JSON.stringify(currentProfile), teacherId]
            );

            if (updateResult.success) {
                return {
                    success: true,
                    data: {
                        message: 'Teacher image deleted successfully'
                    }
                };
            }

            return updateResult;
        } catch (error) {
            console.error('Error deleting teacher image:', error);
            return {
                success: false,
                error: 'Failed to delete teacher image',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Get teacher statistics
     * @param {number} teacherId - Teacher ID
     * @returns {Promise<object>} Teacher statistics
     */
    async getTeacherStats(teacherId) {
        try {
            // Validate teacher exists
            const teacherCheck = await this.query('SELECT id FROM managerial_auth WHERE id = $1', [teacherId]);
            if (!teacherCheck.success || teacherCheck.data.length === 0) {
                return {
                    success: false,
                    error: 'Teacher not found',
                    code: 'TEACHER_NOT_FOUND'
                };
            }

            // Get course count
            const coursesQuery = `
                SELECT COUNT(DISTINCT course_id) as count
                FROM instructor
                WHERE user_id = $1
            `;
            const coursesResult = await this.query(coursesQuery, [teacherId]);
            const totalCourses = coursesResult.success ? parseInt(coursesResult.data[0]?.count || 0) : 0;

            // Get module count
            const modulesQuery = `
                SELECT COUNT(*) as count
                FROM module
                WHERE instructor_id = $1
            `;
            const modulesResult = await this.query(modulesQuery, [teacherId]);
            const totalModules = modulesResult.success ? parseInt(modulesResult.data[0]?.count || 0) : 0;

            // Get student count (enrolled in teacher's courses)
            const studentsQuery = `
                SELECT COUNT(DISTINCT uc.user_id) as count
                FROM user_course uc
                INNER JOIN instructor i ON uc.course_id = i.course_id
                WHERE i.user_id = $1
            `;
            const studentsResult = await this.query(studentsQuery, [teacherId]);
            const totalStudents = studentsResult.success ? parseInt(studentsResult.data[0]?.count || 0) : 0;

            return {
                success: true,
                data: {
                    teacher_id: teacherId,
                    total_courses: totalCourses,
                    total_modules: totalModules,
                    total_students: totalStudents,
                    average_rating: null // Can be added later if rating system exists
                }
            };
        } catch (error) {
            console.error('Error getting teacher statistics:', error);
            return {
                success: false,
                error: 'Failed to get teacher statistics',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Toggle teacher active status
     * @param {number} teacherId - Teacher ID
     * @param {boolean} isActive - Active status
     * @returns {Promise<object>} Update result
     */
    async toggleActiveStatus(teacherId, isActive) {
        try {
            // Get current profile
            const teacherResult = await this.query(
                'SELECT profile FROM managerial_auth WHERE id = $1',
                [teacherId]
            );

            if (!teacherResult.success || teacherResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Teacher not found',
                    code: 'TEACHER_NOT_FOUND'
                };
            }

            const currentProfile = teacherResult.data[0].profile || {};
            currentProfile.isActive = isActive;

            // Update profile
            const updateResult = await this.query(
                'UPDATE managerial_auth SET profile = $1 WHERE id = $2 RETURNING id',
                [JSON.stringify(currentProfile), teacherId]
            );

            if (updateResult.success) {
                return {
                    success: true,
                    data: {
                        teacher_id: teacherId,
                        isActive: isActive,
                        message: `Teacher ${isActive ? 'activated' : 'deactivated'} successfully`
                    }
                };
            }

            return updateResult;
        } catch (error) {
            console.error('Error toggling teacher active status:', error);
            return {
                success: false,
                error: 'Failed to toggle teacher active status',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Bulk assign teachers to course
     * @param {number} courseId - Course ID
     * @param {number[]} teacherIds - Array of teacher IDs
     * @returns {Promise<object>} Bulk assignment result
     */
    async bulkAssignToCourse(courseId, teacherIds) {
        try {
            // Validate course exists
            const courseCheck = await this.query('SELECT id FROM course WHERE id = $1', [courseId]);
            if (!courseCheck.success || courseCheck.data.length === 0) {
                return {
                    success: false,
                    error: 'Course not found',
                    code: 'COURSE_NOT_FOUND'
                };
            }

            if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
                return {
                    success: false,
                    error: 'Teacher IDs array is required',
                    code: 'INVALID_INPUT'
                };
            }

            const results = {
                success: [],
                failed: []
            };

            for (const teacherId of teacherIds) {
                const result = await this.assignToCourse(teacherId, courseId);
                if (result.success) {
                    results.success.push(teacherId);
                } else {
                    results.failed.push({
                        teacher_id: teacherId,
                        error: result.error,
                        code: result.code
                    });
                }
            }

            return {
                success: true,
                data: {
                    course_id: courseId,
                    total: teacherIds.length,
                    successful: results.success.length,
                    failed: results.failed.length,
                    results: results
                }
            };
        } catch (error) {
            console.error('Error in bulk assign to course:', error);
            return {
                success: false,
                error: 'Failed to bulk assign teachers to course',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Replace all instructor assignments for a course (delete existing, insert new)
     * @param {number} courseId - Course ID
     * @param {number[]} teacherIds - Array of teacher IDs (empty = remove all)
     * @returns {Promise<object>} Result
     */
    async replaceInstructorsForCourse(courseId, teacherIds) {
        try {
            const courseCheck = await this.query('SELECT id FROM course WHERE id = $1', [courseId]);
            if (!courseCheck.success || courseCheck.data.length === 0) {
                return { success: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' };
            }

            const client = await this.getClient();
            try {
                await client.query('BEGIN');
                await client.query('DELETE FROM instructor WHERE course_id = $1', [courseId]);
                for (const teacherId of (teacherIds || [])) {
                    await client.query(
                        'INSERT INTO instructor (user_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [teacherId, courseId]
                    );
                }
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }

            return { success: true, data: { course_id: courseId, teacher_ids: teacherIds || [] } };
        } catch (error) {
            console.error('Error replacing instructors for course:', error);
            return { success: false, error: 'Failed to replace instructors', code: 'INTERNAL_SERVER_ERROR' };
        }
    }

    /**
     * Get all instructors for public display (courses page)
     * Returns unique instructors with their profile data, assigned courses, and statistics
     * Only returns active instructors with at least one live course
     * @returns {Promise<object>} List of instructors
     */
    async getPublicInstructors() {
        try {
            return publicInstructorCache.getOrSet(async () => {
                const query = `
                    SELECT
                        ma.id,
                        ma.name,
                        ma.profile,
                        COALESCE(
                            ARRAY_AGG(c.id ORDER BY c.id)
                            FILTER (WHERE c.id IS NOT NULL),
                            '{}'
                        ) AS assigned_courses,
                        COUNT(c.id) AS courses_count,
                        COALESCE(SUM(c.enrolled), 0) AS total_students
                    FROM managerial_auth ma
                    LEFT JOIN instructor i
                        ON i.user_id = ma.id
                    LEFT JOIN course c
                        ON c.id = i.course_id
                       AND c.is_live = true
                    WHERE (
                        ma.type IN (1, 2)
                        OR (
                            ma.profile->>'category' = 'teacher'
                            OR ma.profile->>'category' = 'instructor'
                        )
                    )
                    AND COALESCE((ma.profile->>'isActive')::boolean, true) = true
                    GROUP BY ma.id, ma.name, ma.profile
                    ORDER BY total_students DESC, courses_count DESC, ma.name ASC
                `;

                const result = await this.query(query, []);
                if (!result.success) {
                    return result;
                }

                return {
                    success: true,
                    data: result.data.map((teacher) => {
                        const profile = teacher.profile || {};
                        const assignedCourses = Array.isArray(teacher.assigned_courses)
                            ? teacher.assigned_courses.filter((courseId) => courseId !== null)
                            : [];

                        return {
                            id: teacher.id,
                            name: teacher.name,
                            image: profile.image || null,
                            role: profile.role || null,
                            university: profile.university || null,
                            credibility: profile.credibility || profile.bio || null,
                            achievements: Array.isArray(profile.achievements) ? profile.achievements : [],
                            social: profile.social || {},
                            assignedCourses,
                            isActive: profile.isActive !== undefined ? profile.isActive : true,
                            coursesCount: Number(teacher.courses_count) || 0,
                            totalStudents: Number(teacher.total_students) || 0
                        };
                    })
                };
            });
        } catch (error) {
            console.error('Error getting public instructors:', error);
            return {
                success: false,
                error: 'Failed to get instructors',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }
}

module.exports = { TeacherServiceV2 };
