-- Base schema imported from the latest working production-style dump.
-- This is the canonical bootstrap state before the current auth cleanup migrations.

create table bundle
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



create table in_auth
(
    id       serial
        primary key,
    name     varchar(100)  not null,
    login    varchar(100)  not null
        unique,
    password varchar(2000) not null
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



(









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
