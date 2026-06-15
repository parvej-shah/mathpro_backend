-- Base schema imported from the latest working production-style dump.
-- This is the canonical bootstrap state before the current auth cleanup migrations.




create table aftermessage
(
    id         serial
        primary key,
    type       varchar(100) not null,
    course_ids text,
    bundle_ids text,
    messages   jsonb        not null,
    created_at timestamp default CURRENT_TIMESTAMP,
    updated_at timestamp default CURRENT_TIMESTAMP
);




create index idx_aftermessage_created_at
    on aftermessage (created_at);

create index idx_aftermessage_type
    on aftermessage (type);



create table bundle
(
    id                serial
        primary key,
    title             varchar,
    price             integer,
    url               varchar,
    you_get           json,
    chips             json,
    short_description varchar(1000),
    faq_list          json,
    feedback_list     json,
    intro_video       varchar(500),
    is_live           boolean default false,
    is_active         boolean default true
);

comment on column bundle.you_get is 'JSON array of benefits/features users get with this bundle';

comment on column bundle.chips is 'JSON array of tags/categories for the bundle';

comment on column bundle.short_description is 'Brief description of the bundle for preview';

comment on column bundle.faq_list is 'JSON array of FAQ objects with question and answer';

comment on column bundle.feedback_list is 'JSON array of user feedback/testimonials';

comment on column bundle.intro_video is 'URL to the bundle introduction video';

comment on column bundle.is_live is 'Whether the bundle is currently live/available';

comment on column bundle.is_active is 'Whether the bundle is active in the system';




create index idx_bundle_is_active
    on bundle (is_active);

create index idx_bundle_is_live
    on bundle (is_live);



create table chapter_clone
(
    id            integer,
    course_id     integer,
    title         varchar(1000),
    serial_string varchar(100),
    chips_list    json,
    is_free       boolean,
    is_live       boolean,
    serial        integer
);




create table contact_submissions
(
    id              serial
        primary key,
    full_name       varchar(100) not null,
    email           varchar(255) not null,
    whatsapp_number varchar(50)  not null,
    project_details text         not null,
    ip_address      varchar(45),
    user_agent      text,
    status          varchar(20) default 'new'::character varying,
    created_at      timestamp   default CURRENT_TIMESTAMP,
    updated_at      timestamp   default CURRENT_TIMESTAMP
);

comment on table contact_submissions is 'Stores contact form submissions from Math Pro homepage';

comment on column contact_submissions.status is 'Status: new, read, or replied';




create index idx_contact_submissions_created_at
    on contact_submissions (created_at);

create index idx_contact_submissions_email
    on contact_submissions (email);

create index idx_contact_submissions_ip_address
    on contact_submissions (ip_address);

create index idx_contact_submissions_status
    on contact_submissions (status);



create table coupon_restrictions
(
    id                serial
        primary key,
    coupon_id         integer,
    restriction_type  varchar(30) not null
        constraint coupon_restrictions_restriction_type_check
            check ((restriction_type)::text = ANY
                   (ARRAY [('course'::character varying)::text, ('user'::character varying)::text, ('category'::character varying)::text])),
    restriction_value text        not null,
    created_at        timestamp default CURRENT_TIMESTAMP,
    is_all_courses    boolean   default false
);




create index idx_coupon_restrictions_coupon_id
    on coupon_restrictions (coupon_id);

create index idx_coupon_restrictions_course_type
    on coupon_restrictions (restriction_type, is_all_courses);



create table course
(
    id                serial
        primary key,
    title             varchar(1000),
    x_price           integer,
    price             integer,
    language          varchar(100),
    enrolled          integer,
    you_get           json,
    chips             json,
    short_description varchar(1000),
    instructor_list   json,
    faq_list          json,
    description       varchar(2000),
    feedback_list     json,
    intro_video       varchar(500),
    is_live           boolean,
    serial            integer,
    url               varchar(1000),
    "isActive"        boolean default true not null,
    slug              varchar(255),
    total_seats       integer,
    tags              json,
    course_outline    varchar(1000)
);
create unique index if not exists uq_course_slug on course(slug) where slug is not null;




create table announcements
(
    id                   serial
        primary key,
    user_type            integer      not null,
    course_id            integer      not null
        references course
            on update cascade on delete cascade,
    subject              varchar(255) not null,
    description          text,
    email_is_sent        boolean default false,
    sent_methods         text[],
    created_at           integer,
    sms_is_sent          boolean,
    notification_is_sent boolean
);






create table bundle_course
(
    course_id integer not null
        references course,
    bundle_id integer not null
        references bundle,
    primary key (course_id, bundle_id)
);




create table chapter
(
    id             serial
        primary key,
    course_id      integer
        constraint fk_course_chapters
            references course
            on delete cascade,
    title          varchar(1000),
    serial_string  varchar(100),
    chips_list     json,
    is_free        boolean,
    is_live        boolean,
    serial         integer,
    phase          varchar(20) default 'easy'::character varying not null,
    allowed_unlock boolean     default false
);






create table contest
(
    id        serial
        primary key,
    course_id integer
        constraint fk_contest_course
            references course
            on delete cascade,
    data      json
);








create table course_routine
(
    id                serial
        primary key,
    course_id         integer      not null
        constraint fk_routine_course
            references course
            on update cascade on delete cascade,
    week_number       integer      not null
        constraint check_valid_week_number
            check (week_number > 0),
    routine_image_url varchar(500) not null
        constraint check_routine_url_not_empty
            check (length(TRIM(BOTH FROM routine_image_url)) > 0),
    week_start_date   date         not null,
    week_end_date     date         not null,
    is_active         boolean   default true,
    created_at        timestamp default CURRENT_TIMESTAMP,
    updated_at        timestamp default CURRENT_TIMESTAMP,
    constraint unique_course_start_date
        unique (course_id, week_start_date),
    constraint unique_course_week
        unique (course_id, week_number),
    constraint check_valid_date_range
        check (week_end_date >= week_start_date)
);

comment on table course_routine is 'Stores weekly routine banner images for courses';

comment on column course_routine.course_id is 'Foreign key reference to course table';

comment on column course_routine.week_number is 'Sequential week number for the course';

comment on column course_routine.routine_image_url is 'S3 URL of the routine banner image';

comment on column course_routine.week_start_date is 'Start date of the week (inclusive)';

comment on column course_routine.week_end_date is 'End date of the week (inclusive)';

comment on column course_routine.is_active is 'Flag to enable/disable routine display';




create index idx_routine_active
    on course_routine (course_id, is_active);

create index idx_routine_course_id
    on course_routine (course_id);

create index idx_routine_current_week
    on course_routine (course_id, week_start_date, week_end_date)
    where (is_active = true);

create index idx_routine_week_dates
    on course_routine (week_start_date, week_end_date);



create table feedbacks
(
    id         varchar(255) not null
        primary key,
    course_id  varchar(255) not null,
    user_id    varchar(255) not null,
    rating     integer      not null
        constraint feedbacks_rating_check
            check ((rating >= 1) AND (rating <= 5)),
    comment    text,
    category   varchar(50)
        constraint feedbacks_category_check
            check ((category)::text = ANY
                   (ARRAY [('content'::character varying)::text, ('instructor'::character varying)::text, ('platform'::character varying)::text, ('course'::character varying)::text, ('other'::character varying)::text])),
    created_at timestamp default CURRENT_TIMESTAMP,
    updated_at timestamp default CURRENT_TIMESTAMP,
    unique (course_id, user_id)
);


create index idx_feedbacks_category
    on feedbacks (category);

create index idx_feedbacks_course
    on feedbacks (course_id);

create index idx_feedbacks_created_at
    on feedbacks (created_at);

create index idx_feedbacks_rating
    on feedbacks (rating);

create index idx_feedbacks_user
    on feedbacks (user_id);



create table homepage_data
(
    page_name varchar not null
        primary key,
    data      json
);




create table in_auth
(
    id       serial
        primary key,
    name     varchar(100)  not null,
    login    varchar(100)  not null
        unique,
    password varchar(2000) not null
);






create table in_pr
(
    id        serial
        primary key,
    platform  integer not null,
    level     integer not null,
    data      json    not null,
    parent_id integer
        constraint fk_in_pr_in_pr
            references in_pr
            on delete cascade,
    timestamp integer
);






create table level
(
    id        serial
        primary key,
    course_id integer
        constraint fk_level_course
            references course
            on delete cascade,
    title     varchar,
    threshold integer,
    logo      varchar,
    data      json
);






create table log
(
    id        serial
        primary key,
    name      varchar not null,
    data      json,
    timestamp integer not null
);






create table managerial_auth
(
    id            serial
        primary key,
    name          varchar(100)  not null,
    type          integer       not null,
    login         varchar(100)  not null
        constraint unique_login
            unique,
    password      varchar(2000) not null,
    cf_handle     varchar(100),
    profile       json,
    login_type    varchar(10),
    email         varchar(255),
    phone         varchar(15),
    created_at    timestamp default now(),
    updated_at    timestamp default now(),
    is_privileged boolean   default false
);

comment on column managerial_auth.is_privileged is 'Whether teacher has admin panel access (type=2 privilege). If false, teacher exists in platform but has no login access. Teachers are platform-wide entities, not tied to specific courses/bundles.';




create table activity
(
    id            serial
        primary key,
    user_id       integer not null
        references managerial_auth
            on update cascade on delete cascade,
    date          date    not null,
    duration      integer not null,
    activity_logs jsonb   not null
);






create table bundle_instructor
(
    id            serial
        primary key,
    bundle_id     integer not null
        constraint fk_bundle_instructor_bundle
            references bundle
            on delete cascade,
    instructor_id integer not null
        constraint fk_bundle_instructor_instructor
            references managerial_auth
            on delete cascade,
    created_at    timestamp default now(),
    constraint uk_bundle_instructor
        unique (bundle_id, instructor_id)
);

comment on table bundle_instructor is 'Linking table: Associates teachers (from managerial_auth) with bundles. Teachers exist independently and can be linked to multiple bundles.';

comment on column bundle_instructor.bundle_id is 'Foreign key to bundle table';

comment on column bundle_instructor.instructor_id is 'Foreign key to managerial_auth table (teacher). Teachers are platform-wide entities.';




create index idx_bundle_instructor_bundle_id
    on bundle_instructor (bundle_id);

create index idx_bundle_instructor_instructor_id
    on bundle_instructor (instructor_id);



create table certificate
(
    user_id           integer not null
        constraint fk_certificate_user
            references managerial_auth
            on delete cascade,
    course_id         integer not null
        constraint fk_certificate_course
            references course
            on delete cascade,
    request_timestamp integer,
    certificate_link  varchar,
    issue_timestamp   integer,
    id                varchar
        unique,
    primary key (user_id, course_id)
);




create table contest_participants
(
    id           serial
        primary key,
    contest_id   integer not null
        constraint fk_contest_participants_contest
            references contest
            on delete cascade,
    user_id      integer not null
        constraint fk_contest_participants_user
            references managerial_auth
            on delete cascade,
    score        integer                  default 0,
    joining_date timestamp with time zone default CURRENT_TIMESTAMP,
    constraint unique_contest_participant
        unique (contest_id, user_id)
);






create table coupons
(
    id             serial
        primary key,
    name           varchar(255)                                   not null,
    description    text,
    code           varchar(50)                                    not null
        unique,
    discount_type  varchar(20) default 'fixed'::character varying not null
        constraint chk_discount_type_valid
            check ((discount_type)::text = ANY
                   (ARRAY [('fixed'::character varying)::text, ('percentage'::character varying)::text])),
    discount_value numeric(10, 2)                                 not null
        constraint chk_discount_value_positive
            check (discount_value > (0)::numeric),
    usage_limit    integer
        constraint chk_usage_limit_positive
            check ((usage_limit IS NULL) OR (usage_limit > 0)),
    usage_count    integer     default 0
        constraint chk_usage_count_non_negative
            check (usage_count >= 0),
    start_time     integer                                        not null,
    end_time       integer                                        not null,
    status         varchar(20) default 'active'::character varying
        constraint chk_status_valid
            check ((status)::text = ANY
                   (ARRAY [('active'::character varying)::text, ('inactive'::character varying)::text, ('expired'::character varying)::text, ('deleted'::character varying)::text])),
    created_by     integer
        references managerial_auth,
    created_at     integer                                        not null,
    updated_at     integer                                        not null,
    metadata       jsonb,
    constraint chk_end_after_start
        check (end_time > start_time)
);




create table bundle_purchase
(
    id             serial
        primary key,
    user_id        integer not null
        references managerial_auth,
    bundle_id      integer not null
        references bundle,
    amount         integer not null,
    transaction_id varchar(255)
        unique,
    timestamp      integer not null,
    coupon_id      integer
        references coupons,
    constraint bundle_purchase_unique
        unique (user_id, bundle_id)
);




create index idx_bundle_purchase_bundle_id
    on bundle_purchase (bundle_id);

create index idx_bundle_purchase_user_id
    on bundle_purchase (user_id);



create table coupon_bundles
(
    id         serial
        primary key,
    coupon_id  integer
        references coupons
            on delete cascade,
    bundle_id  integer
        references bundle
            on delete cascade,
    created_at integer not null,
    unique (coupon_id, bundle_id)
);




create index idx_coupon_bundles_bundle_id
    on coupon_bundles (bundle_id);

create index idx_coupon_bundles_coupon_id
    on coupon_bundles (coupon_id);



create table coupon_courses
(
    id         serial
        primary key,
    coupon_id  integer
        references coupons
            on delete cascade,
    course_id  integer
        references course
            on delete cascade,
    created_at integer not null,
    unique (coupon_id, course_id)
);




create index idx_coupon_courses_coupon_id
    on coupon_courses (coupon_id);

create index idx_coupon_courses_course_id
    on coupon_courses (course_id);



create table coupon_usage
(
    id                   serial
        primary key,
    coupon_id            integer
        references coupons,
    user_id              integer
        references managerial_auth,
    course_id            integer
        references course,
    original_price       numeric(10, 2) not null
        constraint chk_original_price_positive
            check (original_price > (0)::numeric),
    discount_amount      numeric(10, 2) not null
        constraint chk_discount_amount_non_negative
            check (discount_amount >= (0)::numeric),
    final_price          numeric(10, 2) not null
        constraint chk_final_price_non_negative
            check (final_price >= (0)::numeric),
    used_at              integer        not null,
    payment_status       varchar(20)    default 'pending'::character varying
        constraint chk_payment_status_valid
            check ((payment_status)::text = ANY
                   (ARRAY [('pending'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text])),
    metadata             jsonb,
    bundle_id            integer
        references bundle,
    transaction_id       varchar(255)
);



create table coupon_clicks
(
    id                    serial
        primary key,
    coupon_id             integer not null
        references coupons
            on delete cascade,
    user_id               integer
                                  references managerial_auth
                                      on delete set null,
    course_id             integer
                                  references course
                                      on delete set null,
    bundle_id             integer
                                  references bundle
                                      on delete set null,
    clicked_at            integer not null,
    user_agent            text,
    metadata              jsonb   default '{}'::jsonb,
    coupon_usage_id       integer
                                  references coupon_usage
                                      on delete set null,
    purchase_completed    boolean default false,
    purchase_completed_at integer,
    transaction_id        varchar(255)
);




create index idx_coupon_clicks_clicked_at
    on coupon_clicks (clicked_at);

create index idx_coupon_clicks_coupon_id
    on coupon_clicks (coupon_id);

create index idx_coupon_clicks_coupon_usage_id
    on coupon_clicks (coupon_usage_id);

create index idx_coupon_clicks_purchase_completed
    on coupon_clicks (purchase_completed);

create index idx_coupon_clicks_user_id
    on coupon_clicks (user_id);



create index idx_coupon_usage_coupon_id
    on coupon_usage (coupon_id);

create index idx_coupon_usage_course_id
    on coupon_usage (course_id);

create index idx_coupon_usage_payment_status
    on coupon_usage (payment_status);

create index idx_coupon_usage_transaction_id
    on coupon_usage (transaction_id);

create index idx_coupon_usage_used_at
    on coupon_usage (used_at);

create index idx_coupon_usage_user_id
    on coupon_usage (user_id);



create index idx_coupons_code
    on coupons (code);

create index idx_coupons_created_by
    on coupons (created_by);

create index idx_coupons_dates
    on coupons (start_time, end_time);

create index idx_coupons_status
    on coupons (status);

create index idx_coupons_usage_count
    on coupons (usage_count);



create table course_import_tracking
(
    id           serial
        primary key,
    import_id    varchar(100)                                        not null
        unique,
    course_id    integer
        constraint fk_import_course
            references course
            on delete set null,
    status       varchar(20) default 'processing'::character varying not null,
    format       varchar(10)                                         not null,
    import_mode  varchar(10)                                         not null,
    summary      jsonb,
    errors       jsonb,
    warnings     jsonb,
    progress     jsonb,
    started_at   timestamp   default now(),
    completed_at timestamp,
    created_by   integer
        constraint fk_import_created_by
            references managerial_auth
            on delete set null
);

comment on table course_import_tracking is 'Tracks bulk course import operations for async processing and status checking';

comment on column course_import_tracking.import_id is 'Unique identifier for the import operation';

comment on column course_import_tracking.status is 'Current status: processing, completed, failed, or partial';

comment on column course_import_tracking.summary is 'JSON summary of import results (chapters_created, modules_created, etc.)';

comment on column course_import_tracking.errors is 'JSON array of error details';

comment on column course_import_tracking.warnings is 'JSON array of warning messages';

comment on column course_import_tracking.progress is 'JSON object with progress tracking (total_items, processed_items, etc.)';




create index idx_import_tracking_course_id
    on course_import_tracking (course_id);

create index idx_import_tracking_created_by
    on course_import_tracking (created_by);

create index idx_import_tracking_import_id
    on course_import_tracking (import_id);

create index idx_import_tracking_status
    on course_import_tracking (status);



create table device_tokens
(
    user_id           integer
                                                             references managerial_auth
                                                                 on delete set null,
    token             varchar(500)                           not null
        primary key,
    platform          varchar(20),
    device_info       varchar(500),
    created_at        timestamp with time zone default now() not null,
    updated_at        timestamp with time zone default now() not null,
    anonymous_id      uuid,
    consent_marketing boolean                  default false,
    last_seen_at      timestamp with time zone default now(),
    constraint chk_device_identity
        check ((user_id IS NOT NULL) OR (anonymous_id IS NOT NULL))
);

comment on table device_tokens is 'Stores FCM device tokens for both registered users and anonymous visitors';

comment on column device_tokens.user_id is 'NULL for anonymous devices; populated when user logs in';

comment on column device_tokens.anonymous_id is 'UUID from frontend for anonymous device tracking (optional)';

comment on column device_tokens.consent_marketing is 'Whether device owner consented to receive marketing notifications';


create index idx_device_tokens_anonymous_id
    on device_tokens (anonymous_id)
    where (anonymous_id IS NOT NULL);

create index idx_device_tokens_consent
    on device_tokens (consent_marketing asc, last_seen_at desc)
    where (consent_marketing = true);

create index idx_device_tokens_user_id
    on device_tokens (user_id)
    where (user_id IS NOT NULL);



create table gift
(
    user_id           integer not null
        constraint fk_gift_user
            references managerial_auth
            on delete cascade,
    level_id          integer not null
        constraint fk_gift_level
            references level
            on delete cascade,
    request_timestamp integer,
    confirm_timestamp integer,
    primary key (user_id, level_id)
);




create table instructor
(
    user_id   integer not null
        constraint fk_instructor_user
            references managerial_auth
            on delete cascade,
    course_id integer not null
        constraint fk_instructor_course
            references course
            on delete cascade,
    primary key (user_id, course_id)
);




create table issue
(
    id        serial
        primary key,
    user_id   integer
        constraint fk_issue_user
            references managerial_auth
            on delete cascade,
    data      json,
    status    varchar,
    timestamp integer
);






create table live
(
    id           serial
        primary key,
    course_id    integer
        constraint fk_course_live
            references course
            on delete cascade,
    title        varchar(1000),
    description  varchar(1000),
    thumbnail    varchar(1000),
    can_join     boolean,
    scheduled_at integer,
    duration     varchar(100),
    meeting_id   varchar(100),
    meeting_pass varchar(100),
    teacher_id   integer
        constraint fk_live_teacher
            references managerial_auth
            on delete cascade,
    data         json
);




create table interest
(
    user_id integer not null
        constraint fk_interest_user
            references managerial_auth
            on delete cascade,
    live_id integer not null
        constraint fk_interest_live
            references live
            on delete cascade,
    primary key (user_id, live_id)
);






create table live_feed
(
    id        serial
        primary key,
    user_id   integer
        constraint fk_feed_user
            references managerial_auth
            on delete cascade,
    live_id   integer
        constraint fk_feed_live
            references live
            on delete cascade,
    timestamp integer,
    feed      json
);






create index idx_managerial_auth_email
    on managerial_auth (email)
    where (email IS NOT NULL);

create index idx_managerial_auth_is_privileged
    on managerial_auth (is_privileged);

create index idx_managerial_auth_phone
    on managerial_auth (phone)
    where (phone IS NOT NULL);



create table module
(
    id                           serial
        primary key,
    chapter_id                   integer
        constraint fk_chapter_modules
            references chapter
            on delete cascade,
    title                        varchar(1000),
    description                  varchar(4000),
    metadata                     json,
    data                         json,
    is_live                      boolean,
    is_free                      boolean,
    serial                       integer,
    score                        integer default 0 not null,
    difficulty                   varchar(20),
    instructor_id                integer
        constraint fk_module_instructor
            references managerial_auth
            on delete set null,
    will_evaluated               boolean default true,
    quiz_time_limit              integer,
    quiz_attempt_limit           integer,
    pdf_drive_link               text,
    assignment_question_doc_url  text,
    assignment_question_doc_type varchar(20)
);

comment on column module.instructor_id is 'Foreign key to managerial_auth table (teacher/instructor)';

comment on column module.will_evaluated is 'Whether assignment will be evaluated (for ASSIGNMENT modules)';

comment on column module.quiz_time_limit is 'Time limit for quiz in minutes (for QUIZ modules)';

comment on column module.quiz_attempt_limit is 'Maximum number of attempts allowed for quiz (for QUIZ modules)';

comment on column module.pdf_drive_link is 'Google Drive link for PDF (alternative to S3, for VIDEO/PDF modules)';

comment on column module.assignment_question_doc_url is 'URL to assignment question document (S3 or Google Drive)';

comment on column module.assignment_question_doc_type is 'Type of document storage: s3 or drive';




create table assignment
(
    id                                   serial
        primary key,
    module_id                            integer not null
        unique
        references module
            on delete cascade,
    will_evaluated                       boolean       default true,
    assignment_start_date                timestamp,
    assignment_end_date                  timestamp,
    late_submission_deduction_percentage numeric(5, 2) default 10.00
        constraint chk_late_deduction_percentage
            check ((late_submission_deduction_percentage >= (0)::numeric) AND
                   (late_submission_deduction_percentage <= (50)::numeric)),
    allowed_submission_types             jsonb,
    max_file_size_mb                     integer       default 50
        constraint chk_max_file_size_positive
            check (max_file_size_mb > 0),
    max_total_size_mb                    integer       default 200
        constraint chk_max_total_size_positive
            check (max_total_size_mb > 0),
    max_files_count                      integer       default 1
        constraint chk_max_files_count_positive
            check (max_files_count > 0),
    is_published                         boolean       default false,
    created_at                           timestamp     default CURRENT_TIMESTAMP,
    updated_at                           timestamp     default CURRENT_TIMESTAMP,
    solution_video_url                   text,
    solution_text                        text,
    constraint chk_assignment_dates
        check ((assignment_start_date IS NULL) OR (assignment_end_date IS NULL) OR
               (assignment_end_date >= assignment_start_date))
);

comment on table assignment is 'Stores assignment-specific configuration and settings (one-to-one with module)';

comment on column assignment.module_id is 'Foreign key to module table (unique - one assignment per module)';

comment on column assignment.will_evaluated is 'Whether assignment will be evaluated (TRUE) or self-paced (FALSE)';

comment on column assignment.assignment_start_date is 'Start date/time for evaluated assignments (NULL for non-evaluated)';

comment on column assignment.assignment_end_date is 'End date/time (deadline) for evaluated assignments (NULL for non-evaluated)';

comment on column assignment.late_submission_deduction_percentage is 'Late submission deduction percentage per day (default 10%, max 50%)';

comment on column assignment.allowed_submission_types is 'JSONB array of allowed file types: ["pdf", "doc", "zip"]';

comment on column assignment.max_file_size_mb is 'Maximum file size per file in MB (default 50MB)';

comment on column assignment.max_total_size_mb is 'Maximum total size for all files in MB (default 200MB)';

comment on column assignment.max_files_count is 'Maximum number of files allowed (default 1)';

comment on column assignment.is_published is 'Whether assignment is published and visible to students';

comment on column assignment.solution_video_url is 'Solution video URL (YouTube, Vimeo, etc.) - URL-based only, optional';

comment on column assignment.solution_text is 'Solution text/description in rich text/HTML format - optional';




create index idx_assignment_end_date
    on assignment (assignment_end_date);

create index idx_assignment_is_published
    on assignment (is_published);

create index idx_assignment_module_id
    on assignment (module_id);

create index idx_assignment_start_date
    on assignment (assignment_start_date);

create index idx_assignment_will_evaluated
    on assignment (will_evaluated);



create table compilation
(
    id        serial
        primary key,
    user_id   integer
        constraint fk_compilation_user
            references managerial_auth
            on delete cascade,
    module_id integer
        constraint fk_compilaton_module
            references module
            on delete cascade,
    timestamp integer,
    data      json
);






create table editorial_view
(
    user_id   integer not null
        constraint fk_editorial_user
            references managerial_auth
            on delete cascade,
    module_id integer not null
        constraint fk_editorial_module
            references module
            on delete cascade,
    primary key (user_id, module_id)
);




create index idx_module_chapter_will_evaluated
    on module (chapter_id, will_evaluated)
    where (will_evaluated IS NOT NULL);

create index idx_module_will_evaluated
    on module (will_evaluated)
    where (will_evaluated IS NOT NULL);

create index idx_modules_instructor_id
    on module (instructor_id);

create index idx_modules_will_evaluated
    on module (will_evaluated);



create table module_clone
(
    id          integer,
    chapter_id  integer,
    title       varchar(1000),
    description varchar(4000),
    metadata    json,
    data        json,
    is_live     boolean,
    is_free     boolean,
    serial      integer,
    score       integer
);




create table module_feedback_reasons
(
    id            serial
        primary key,
    reason_key    varchar(50)  not null
        unique,
    reason_label  varchar(100) not null,
    description   text,
    is_active     boolean   default true,
    display_order integer   default 0,
    created_at    timestamp default CURRENT_TIMESTAMP,
    updated_at    timestamp default CURRENT_TIMESTAMP
);

comment on table module_feedback_reasons is 'Stores dynamic feedback reasons that can be managed by admins';

comment on column module_feedback_reasons.reason_key is 'Unique identifier key for the reason (used in API)';

comment on column module_feedback_reasons.reason_label is 'User-friendly label displayed in UI';

comment on column module_feedback_reasons.description is 'Detailed description of when to use this reason';

comment on column module_feedback_reasons.is_active is 'Whether this reason is currently available for selection';

comment on column module_feedback_reasons.display_order is 'Order in which reasons should be displayed';




create table module_feedback
(
    id         serial
        primary key,
    module_id  integer     not null
        constraint fk_module_feedback_module
            references module
            on delete cascade,
    user_id    integer     not null
        constraint fk_module_feedback_user
            references managerial_auth
            on delete cascade,
    course_id  integer     not null
        constraint fk_module_feedback_course
            references course
            on delete cascade,
    chapter_id integer     not null
        constraint fk_module_feedback_chapter
            references chapter
            on delete cascade,
    reaction   varchar(10) not null
        constraint module_feedback_reaction_check
            check ((reaction)::text = ANY
                   (ARRAY [('like'::character varying)::text, ('dislike'::character varying)::text])),
    reason     varchar(50)
        constraint fk_module_feedback_reason
            references module_feedback_reasons (reason_key)
            on delete restrict,
    comment    text,
    created_at timestamp default CURRENT_TIMESTAMP,
    updated_at timestamp default CURRENT_TIMESTAMP,
    unique (module_id, user_id)
);

comment on table module_feedback is 'Stores per-module feedback with like/dislike reactions and optional detailed feedback';

comment on column module_feedback.reaction is 'User reaction: like or dislike';

comment on column module_feedback.reason is 'Reason key from module_feedback_reasons table (dynamic, managed via admin API)';

comment on column module_feedback.comment is 'Optional detailed comment or suggestion from user';




create index idx_module_feedback_chapter
    on module_feedback (chapter_id);

create index idx_module_feedback_course
    on module_feedback (course_id);

create index idx_module_feedback_created
    on module_feedback (created_at);

create index idx_module_feedback_module
    on module_feedback (module_id);

create index idx_module_feedback_reaction
    on module_feedback (reaction);

create index idx_module_feedback_reason
    on module_feedback (reason);

create index idx_module_feedback_user
    on module_feedback (user_id);



create index idx_module_feedback_reasons_active
    on module_feedback_reasons (is_active);

create index idx_module_feedback_reasons_key
    on module_feedback_reasons (reason_key);



create table notification
(
    id                   serial
        primary key,
    type                 varchar                   not null,
    data                 json                      not null,
    user_id              integer
        references managerial_auth,
    course_id            integer
        references course,
    is_read              boolean     default false not null,
    timestamp            integer,
    is_bell_icon_clicked boolean     default false,
    delivery_channel     varchar(16) default 'in_app'::character varying
        constraint chk_delivery_channel
            check ((delivery_channel)::text = ANY
                   (ARRAY [('in_app'::character varying)::text, ('fcm'::character varying)::text, ('email'::character varying)::text, ('sms'::character varying)::text]))
);

comment on column notification.delivery_channel is 'Delivery method: in_app (shown immediately), fcm (push notification), email, sms';




create index idx_notification_delivery_channel
    on notification (user_id asc, delivery_channel asc, timestamp desc);

create index idx_notification_unread_count
    on notification (user_id asc, is_read asc, timestamp desc)
    where (is_read = false);



create table notification_event_channel_config
(
    id         serial
        primary key,
    event_code varchar(100)                           not null,
    channel    varchar(50)                            not null,
    is_enabled boolean                  default true  not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    unique (event_code, channel)
);

comment on table notification_event_channel_config is 'Per-event per-channel enable/disable; frontend toggles; worker filters by this before sending.';




create index idx_notification_event_channel_config_event
    on notification_event_channel_config (event_code);

create index idx_notification_event_channel_config_lookup
    on notification_event_channel_config (event_code, channel)
    where (is_enabled = true);



create table notification_jobs
(
    id            serial
        primary key,
    payload       jsonb                                                         not null,
    status        varchar(50)              default 'pending'::character varying not null
        constraint chk_notification_jobs_status
            check ((status)::text = ANY
                   (ARRAY [('pending'::character varying)::text, ('processing'::character varying)::text, ('sent'::character varying)::text, ('failed'::character varying)::text, ('exhausted'::character varying)::text])),
    retry_count   integer                  default 0                            not null,
    next_retry_at timestamp with time zone,
    created_at    timestamp with time zone default now()                        not null,
    claimed_at    timestamp with time zone
);




create index idx_notification_jobs_status_next_retry
    on notification_jobs (status, next_retry_at)
    where ((status)::text = ANY (ARRAY [('pending'::character varying)::text, ('failed'::character varying)::text]));



create table notification_log
(
    id                serial
        primary key,
    event_code        varchar(100)                           not null,
    channel           varchar(50)                            not null,
    recipient_id      integer
        references managerial_auth,
    recipient_contact varchar(255),
    template_id       integer,
    idempotency_key   varchar(255),
    status            varchar(50)                            not null,
    error_code        varchar(100),
    provider_response text,
    created_at        timestamp with time zone default now() not null
);




create index idx_notification_log_event_channel_created
    on notification_log (event_code, channel, created_at);

create unique index idx_notification_log_idempotency_key
    on notification_log (idempotency_key)
    where (idempotency_key IS NOT NULL);

create index idx_notification_log_recipient_id
    on notification_log (recipient_id);



create table notification_providers
(
    id          serial
        primary key,
    channel     varchar(50)           not null,
    name        varchar(100)          not null,
    adapter_key varchar(100)          not null,
    config      jsonb   default '{}'::jsonb,
    is_default  boolean default false not null
);




create index idx_notification_providers_channel_default
    on notification_providers (channel, is_default);



create table notification_templates
(
    id                        serial
        primary key,
    name                      varchar(255)                           not null,
    code                      varchar(100)                           not null,
    channel                   varchar(50)                            not null,
    subject                   varchar(500),
    body_html                 text,
    body_plain                text,
    variables                 jsonb                    default '[]'::jsonb,
    sms_encoding              varchar(50),
    sms_max_segments          integer                  default 2,
    sms_max_chars_per_segment integer,
    tags                      jsonb                    default '[]'::jsonb,
    is_active                 boolean                  default true  not null,
    version                   integer                  default 1     not null,
    content_type              varchar(100),
    language                  varchar(20),
    created_at                timestamp with time zone default now() not null,
    updated_at                timestamp with time zone default now() not null,
    created_by                integer
        references managerial_auth
);




create unique index idx_notification_templates_code_channel
    on notification_templates (code, channel);



create table otp
(
    id           serial
        primary key,
    phone        varchar,
    otp          varchar,
    timestamp    integer,
    is_used      boolean,
    email        varchar(255),
    contact_type varchar(10),
    expires_at   integer,
    purpose      varchar(50)
);






create table payment_audit_log
(
    id                      serial
        primary key,
    sslcommerz_tran_id      varchar(255),
    internal_transaction_id varchar(255),
    user_id                 integer
        references managerial_auth,
    item_id                 integer,
    item_type               varchar(50) not null,
    amount                  numeric(10, 2),
    status                  varchar(50) not null,
    ipn_payload             jsonb,
    processing_status       varchar(50) not null,
    error_message           text,
    processing_result       jsonb,
    timestamp               integer     not null,
    processed_at            integer,
    retry_count             integer default 0,
    is_manually_reconciled  boolean default false,
    reconciled_by           integer
        references managerial_auth,
    reconciled_at           integer,
    notes                   text
);




create index idx_payment_audit_log_internal_transaction_id
    on payment_audit_log (internal_transaction_id);

create index idx_payment_audit_log_item_id_type
    on payment_audit_log (item_id, item_type);

create index idx_payment_audit_log_processing_status
    on payment_audit_log (processing_status);

create index idx_payment_audit_log_sslcommerz_tran_id
    on payment_audit_log (sslcommerz_tran_id);

create index idx_payment_audit_log_status
    on payment_audit_log (status);

create index idx_payment_audit_log_timestamp
    on payment_audit_log (timestamp);

create index idx_payment_audit_log_user_id
    on payment_audit_log (user_id);



create table payment_coupon_tracking
(
    id              serial
        primary key,
    transaction_id  varchar(255)   not null
        unique,
    coupon_id       integer
        references coupons,
    coupon_code     varchar(50)    not null,
    user_id         integer
        references managerial_auth,
    item_id         integer        not null,
    item_type       varchar(20)    not null,
    original_price  numeric(10, 2) not null,
    discount_amount numeric(10, 2) not null,
    final_price     numeric(10, 2) not null,
    created_at      integer        not null,
    expires_at      integer        not null,
    is_used         boolean default false,
    metadata        jsonb
);




create index idx_payment_coupon_tracking_expires_at
    on payment_coupon_tracking (expires_at);

create index idx_payment_coupon_tracking_transaction_id
    on payment_coupon_tracking (transaction_id);



create table prebooking
(
    id        serial
        primary key,
    user_id   integer
        constraint fk_prebooking_user
            references managerial_auth
            on delete cascade,
    course_id integer
        constraint fk_prebooking_course
            references course
            on delete cascade,
    email     varchar not null,
    phone     varchar not null,
    name      varchar not null,
    timestamp integer,
    utm       varchar(50),
    constraint order_unique
        unique (user_id, course_id)
);

comment on column prebooking.utm is 'UTM parameter to track source/campaign (e.g., courseDemo, bootcampClass)';






create table prebooking_bundle
(
    id        serial
        primary key,
    user_id   integer,
    bundle_id integer
        references bundle,
    email     varchar not null,
    phone     varchar not null,
    name      varchar not null,
    timestamp integer,
    utm       varchar(50)
);

comment on column prebooking_bundle.utm is 'UTM parameter to track source/campaign (e.g., courseDemo, bootcampClass)';






create table progress
(
    user_id   integer not null
        constraint fk_progress_user
            references managerial_auth
            on delete cascade,
    module_id integer not null
        constraint fk_progress_module
            references module
            on delete cascade,
    point     integer,
    timestamp integer,
    primary key (user_id, module_id)
);




create table public_notifications
(
    id         serial
        primary key,
    type       varchar(50)  not null,
    title      varchar(255) not null,
    body       text         not null,
    data       jsonb                    default '{}'::jsonb,
    priority   integer                  default 0,
    is_active  boolean                  default true,
    created_by integer
                            references managerial_auth
                                on delete set null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public_notifications is 'Marketing/promotional notifications visible to all users (registered and anonymous). Not tied to individual users.';

comment on column public_notifications.type is 'Notification category: PROMO, ANNOUNCEMENT, COURSE_LAUNCH, COUPON, etc.';

comment on column public_notifications.data is 'JSON payload: imageUrl, ctaLink, courseId, couponCode, validUntil, etc.';

comment on column public_notifications.priority is 'Display order (higher numbers shown first). Default: 0';

comment on column public_notifications.is_active is 'Whether notification is currently shown to users. False = soft deleted.';




create index idx_public_notifications_active_list
    on public_notifications (is_active asc, priority desc, created_at desc)
    where (is_active = true);

create index idx_public_notifications_created_by
    on public_notifications (created_by asc, created_at desc);



create table response
(
    id        serial
        primary key,
    user_id   integer
        constraint fk_response_user
            references managerial_auth
            on delete cascade,
    issue_id  integer
        constraint fk_response_issue
            references issue
            on delete cascade,
    data      json,
    timestamp integer
);






create table roles
(
    id           serial
        primary key,
    name         varchar(100)                  not null
        unique,
    display_name varchar(100)                  not null,
    description  text,
    permissions  jsonb     default '[]'::jsonb not null,
    created_at   timestamp default now()       not null,
    updated_at   timestamp default now()       not null
);

comment on table roles is 'Stores role definitions with scope-based permissions. Each role contains a JSONB array of permission strings following the pattern: resource.action.scope';

comment on column roles.name is 'Unique role identifier (e.g., admin, moderator, student)';

comment on column roles.display_name is 'Human-readable name for UI display (e.g., Administrator, Content Moderator)';

comment on column roles.description is 'Description of role purpose and responsibilities';

comment on column roles.permissions is 'JSONB array of permission strings (e.g., ["user.read.all", "course.create.all"])';




create index idx_roles_name
    on roles (name);

create index idx_roles_permissions
    on roles using gin (permissions);



create table sms_history
(
    id          serial
        primary key,
    message     text        not null,
    course_id   integer
        references course,
    class_id    integer,
    timestamp   integer     not null,
    status      varchar(50) not null,
    retry_count integer default 0,
    metadata    jsonb
);




create index idx_sms_history_class_id
    on sms_history (class_id);

create index idx_sms_history_course_id
    on sms_history (course_id);



create table sms_recipients
(
    id            serial
        primary key,
    sms_id        integer
        references sms_history
            on delete cascade,
    student_id    integer
        references managerial_auth,
    phone         varchar(20) not null,
    status        varchar(50) not null,
    error_message text,
    timestamp     integer     not null
);




create index idx_sms_recipients_sms_id
    on sms_recipients (sms_id);

create index idx_sms_recipients_student_id
    on sms_recipients (student_id);




create table submission
(
    user_id                integer                                               not null
        constraint fk_progress_user
            references managerial_auth
            on delete cascade,
    module_id              integer                                               not null
        constraint fk_progress_module
            references module
            on delete cascade,
    status                 varchar(20)    default 'SUBMITTED'::character varying not null,
    submission             json,
    evaluation             json,
    updated_at             integer                                               not null,
    is_late                boolean        default false,
    late_deduction_applied numeric(10, 2) default 0.00,
    submitted_at           timestamp,
    evaluated_at           timestamp,
    evaluated_by           integer
        constraint fk_submission_evaluated_by
            references managerial_auth
            on delete set null,
    submitted_files_count  integer        default 0,
    solution_released_at   timestamp,
    solution_released_by   integer
        constraint fk_submission_solution_released_by
            references managerial_auth
            on delete set null,
    primary key (user_id, module_id)
);

comment on column submission.is_late is 'Whether submission was made after deadline';

comment on column submission.late_deduction_applied is 'Deduction amount applied for late submission';

comment on column submission.submitted_at is 'Exact timestamp when submission was made';

comment on column submission.evaluated_at is 'Timestamp when evaluation was completed';

comment on column submission.evaluated_by is 'Foreign key to managerial_auth (instructor who evaluated)';

comment on column submission.submitted_files_count is 'Number of files submitted';

comment on column submission.solution_released_at is 'Timestamp when assignment solution was released for this student submission';

comment on column submission.solution_released_by is 'Admin/instructor id who released solution (auto on evaluate)';


create table assignment_files
(
    id                   serial
        primary key,
    submission_user_id   integer,
    submission_module_id integer,
    module_id            integer
        references module
            on delete cascade,
    file_type            varchar(20)  not null
        constraint chk_assignment_files_file_type
            check ((file_type)::text = ANY
                   (ARRAY [('instruction'::character varying)::text, ('submission'::character varying)::text, ('solution'::character varying)::text])),
    file_name            varchar(255) not null,
    file_size            bigint       not null,
    file_url             text         not null,
    file_mime_type       varchar(100) not null,
    uploaded_at          timestamp default CURRENT_TIMESTAMP,
    uploaded_by          integer
                                      references managerial_auth
                                          on delete set null,
    assignment_id        integer
        references assignment
            on delete cascade,
    foreign key (submission_user_id, submission_module_id) references submission
        on delete cascade,
    constraint chk_assignment_files_reference
        check (((submission_user_id IS NOT NULL) AND (submission_module_id IS NOT NULL) AND (module_id IS NULL) AND
                (assignment_id IS NULL)) OR ((submission_user_id IS NULL) AND (submission_module_id IS NULL) AND
                                             ((module_id IS NOT NULL) OR (assignment_id IS NOT NULL))))
);

comment on table assignment_files is 'Stores metadata for uploaded assignment files (instructions, submissions, and solutions)';

comment on column assignment_files.submission_user_id is 'User ID part of submission composite key (for submission files)';

comment on column assignment_files.submission_module_id is 'Module ID part of submission composite key (for submission files)';

comment on column assignment_files.module_id is 'Foreign key to module (for instruction files)';

comment on column assignment_files.file_type is 'Type of file: instruction, submission, or solution';

comment on column assignment_files.file_name is 'Original file name';

comment on column assignment_files.file_size is 'File size in bytes';

comment on column assignment_files.file_url is 'S3 URL of the file';

comment on column assignment_files.file_mime_type is 'MIME type of the file';

comment on column assignment_files.uploaded_by is 'Foreign key to managerial_auth (for instruction files) or user_id (for submissions)';




create index idx_assignment_files_assignment_id
    on assignment_files (assignment_id);

create index idx_assignment_files_assignment_type
    on assignment_files (assignment_id, file_type)
    where (assignment_id IS NOT NULL);

create index idx_assignment_files_file_type
    on assignment_files (file_type);

create index idx_assignment_files_module_id
    on assignment_files (module_id);

create index idx_assignment_files_solution
    on assignment_files (assignment_id, file_type)
    where ((file_type)::text = 'solution'::text);

create index idx_assignment_files_submission
    on assignment_files (submission_user_id, submission_module_id);

create index idx_assignment_files_uploaded_at
    on assignment_files (uploaded_at);



create index idx_submission_evaluated_at
    on submission (evaluated_at);

create index idx_submission_evaluated_by
    on submission (evaluated_by);

create index idx_submission_is_late
    on submission (is_late)
    where (is_late = true);

create index idx_submission_module_status
    on submission (module_id, status);

create index idx_submission_solution_released_at
    on submission (solution_released_at)
    where (solution_released_at IS NOT NULL);

create index idx_submission_solution_released_by
    on submission (solution_released_by)
    where (solution_released_by IS NOT NULL);

create index idx_submission_status
    on submission (status);

create index idx_submission_submitted_at
    on submission (submitted_at);

create index idx_submission_user_module
    on submission (user_id, module_id);



create table system_config
(
    id           serial
        primary key,
    config_key   varchar(100) not null
        unique,
    config_value jsonb        not null,
    description  text,
    updated_by   integer
        references managerial_auth,
    created_at   timestamp default now(),
    updated_at   timestamp default now()
);




create index idx_system_config_key
    on system_config (config_key);



create table takes
(
    user_id        integer not null
        constraint fk_takes_user
            references managerial_auth
            on delete cascade,
    course_id      integer not null
        constraint fk_takes_course
            references course
            on delete cascade,
    timestamp      integer,
    amount         integer,
    transaction_id varchar,
    coupon_id      integer
        references coupons,
    primary key (user_id, course_id),
    constraint takes_unique_enrollment
        unique (user_id, course_id)
);


create index idx_takes_coupon_id
    on takes (coupon_id);



create table transaction_logs
(
    id               serial
        primary key,
    transaction_id   varchar(255)                                  not null
        unique,
    val_id           varchar(255),
    tran_id          varchar(255),
    amount           numeric(10, 2),
    currency         varchar(10) default 'BDT'::character varying,
    status           varchar(50),
    user_id          integer
        references managerial_auth,
    course_id        integer,
    payment_method   varchar(50),
    gateway_response jsonb,
    processed_at     integer                                       not null,
    created_at       integer     default EXTRACT(epoch FROM now()) not null,
    metadata         jsonb
);

comment on table transaction_logs is 'Tracks all payment transactions for audit and duplicate prevention';




create index idx_transaction_logs_course_id
    on transaction_logs (course_id);

create index idx_transaction_logs_created_at
    on transaction_logs (created_at);

create index idx_transaction_logs_status
    on transaction_logs (status);

create index idx_transaction_logs_transaction_id
    on transaction_logs (transaction_id);

create index idx_transaction_logs_user_id
    on transaction_logs (user_id);

create index idx_transaction_logs_val_id
    on transaction_logs (val_id);



create table user_course_streaks
(
    user_id            integer not null,
    course_id          integer not null,
    current_streak     integer   default 0
        constraint user_course_streaks_current_streak_check
            check (current_streak >= 0),
    longest_streak     integer   default 0
        constraint user_course_streaks_longest_streak_check
            check (longest_streak >= 0),
    last_activity_date date    not null,
    created_at         timestamp default now(),
    updated_at         timestamp default now(),
    primary key (user_id, course_id),
    constraint chk_longest_streak_gte_current
        check (longest_streak >= current_streak)
);

comment on table user_course_streaks is 'Tracks daily learning streaks for users in specific courses';

comment on column user_course_streaks.current_streak is 'Current consecutive days of activity';

comment on column user_course_streaks.longest_streak is 'Longest streak ever achieved in this course';

comment on column user_course_streaks.last_activity_date is 'Last date user had activity in this course (in user timezone)';


create index idx_course_streaks
    on user_course_streaks (course_id);

create index idx_last_activity
    on user_course_streaks (last_activity_date desc);

create index idx_longest_streaks
    on user_course_streaks (longest_streak desc);

create index idx_user_streaks
    on user_course_streaks (user_id);



create table user_module_views
(
    id             serial
        primary key,
    user_id        integer not null
        references managerial_auth
            on delete cascade,
    course_id      integer not null
        references course
            on delete cascade,
    module_id      integer not null
        references module
            on delete cascade,
    chapter_id     integer not null,
    viewed_at      integer not null,
    view_count     integer default 1,
    last_viewed_at integer not null,
    unique (user_id, course_id, module_id)
);

comment on table user_module_views is 'Tracks recently viewed modules for users in specific courses (last 5 per course)';

comment on column user_module_views.viewed_at is 'First time viewed (Unix timestamp in seconds)';

comment on column user_module_views.view_count is 'Number of times user viewed this module in this course';

comment on column user_module_views.last_viewed_at is 'Most recent view time (Unix timestamp in seconds)';




create index idx_user_module_views_course
    on user_module_views (course_id);

create index idx_user_module_views_last_viewed
    on user_module_views (last_viewed_at desc);

create index idx_user_module_views_module
    on user_module_views (module_id);

create index idx_user_module_views_user
    on user_module_views (user_id);

create index idx_user_module_views_user_course
    on user_module_views (user_id, course_id);

create index idx_user_module_views_user_course_timestamp
    on user_module_views (user_id asc, course_id asc, last_viewed_at desc);



create table user_roles
(
    id         serial
        primary key,
    user_id    integer                 not null
        constraint fk_user_roles_user
            references managerial_auth
            on delete cascade,
    role_id    integer                 not null
        constraint fk_user_roles_role
            references roles
            on delete cascade,
    created_at timestamp default now() not null,
    updated_at timestamp default now() not null,
    updated_by integer
        constraint fk_user_roles_updated_by
            references managerial_auth
            on delete set null,
    constraint uk_user_roles_user_role
        unique (user_id, role_id)
);

comment on table user_roles is 'Junction table linking users to roles (many-to-many). Tracks who assigned/updated roles for audit purposes.';

comment on column user_roles.user_id is 'References managerial_auth.id - the user being assigned a role';

comment on column user_roles.role_id is 'References roles.id - the role being assigned';

comment on column user_roles.updated_by is 'References managerial_auth.id - tracks who last updated this role assignment';




create index idx_user_roles_role_id
    on user_roles (role_id);

create index idx_user_roles_updated_by
    on user_roles (updated_by);

create index idx_user_roles_user_id
    on user_roles (user_id);



create table user_tags
(
    user_id    integer                                not null
        references managerial_auth
            on delete cascade,
    tag        varchar(100)                           not null,
    created_at timestamp with time zone default now() not null,
    primary key (user_id, tag)
);


create index idx_user_tags_tag
    on user_tags (tag);



create table users
(
    id               serial
        primary key,
    full_name        varchar(255)          not null,
    registration_no  varchar(50)           not null
        unique,
    phone            varchar(20)           not null
        unique,
    password         varchar(255)          not null,
    role_technician  boolean default false not null,
    role_radiologist boolean default false not null,
    hospital         varchar(255),
    image_url        text
);






create function get_user_permissions(p_user_id integer) returns jsonb
    stable
    language plpgsql
as
$$
    DECLARE
        v_permissions JSONB;
    BEGIN
        -- Aggregate all permissions from all roles assigned to the user
        -- Remove duplicates using jsonb_agg and DISTINCT
        SELECT COALESCE(
            jsonb_agg(DISTINCT permission),
            '[]'::jsonb
        )
        INTO v_permissions
        FROM (
            SELECT jsonb_array_elements_text(r.permissions) as permission
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = p_user_id
        ) AS user_permissions;
        
        RETURN v_permissions;
    END;
    $$;

comment on function get_user_permissions(integer) is 'Returns aggregated JSONB array of all permissions for a user from all assigned roles. Removes duplicates automatically.';




create function update_assignment_updated_at() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;




create function update_course_routine_timestamp() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;




create function update_device_last_seen() returns trigger
    language plpgsql
as
$$
BEGIN
  NEW.last_seen_at = NOW();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;




create function update_milestone_progress_timestamp() returns trigger
    language plpgsql
as
$$
    BEGIN
        NEW.updated_at = NOW();
        -- Auto-calculate progress percentage
        IF NEW.target_value > 0 THEN
            NEW.progress_percentage = LEAST(100, (NEW.current_value / NEW.target_value) * 100);
        END IF;
        RETURN NEW;
    END;
    $$;




create function update_module_feedback_reasons_updated_at() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;




create function update_module_feedback_updated_at() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;




create function update_updated_at_column() returns trigger
    language plpgsql
as
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
