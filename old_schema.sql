-- we don't know how to generate root <with-no-name> (class Root) :(

comment on database postgres is 'default administrative connection database';

grant connect, create, temporary on database Math Pro to app_user;

grant connect, create, temporary on database Math Pro to dev_user;

create table ambassador_tiers
(
    id                serial
        primary key,
    name              varchar(50)           not null
        unique,
    display_name      varchar(100)          not null,
    min_sales         integer     default 0 not null,
    max_sales         integer,
    bonus_rate        numeric(5, 2)         not null,
    color             varchar(20) default '#808080'::character varying,
    icon              varchar(50),
    benefits          text,
    is_active         boolean     default true,
    sort_order        integer     default 0,
    created_at        timestamp   default now(),
    updated_at        timestamp   default now(),
    bonus_description varchar(100)
);

alter table ambassador_tiers
    owner to postgres;

grant select, update, usage on sequence ambassador_tiers_id_seq to app_user;

grant select, update, usage on sequence ambassador_tiers_id_seq to dev_user;

create index idx_ambassador_tiers_active
    on ambassador_tiers (is_active);

create index idx_ambassador_tiers_sales_range
    on ambassador_tiers (min_sales, max_sales);

grant delete, insert, references, select, trigger, truncate, update on ambassador_tiers to app_user;

grant delete, insert, references, select, trigger, truncate, update on ambassador_tiers to dev_user;

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

alter table bundle
    owner to postgres;

grant select, update, usage on sequence bundle_id_seq to app_user;

grant select, update, usage on sequence bundle_id_seq to dev_user;

create index idx_bundle_is_active
    on bundle (is_active);

create index idx_bundle_is_live
    on bundle (is_live);

grant delete, insert, references, select, trigger, truncate, update on bundle to app_user;

grant delete, insert, references, select, trigger, truncate, update on bundle to dev_user;

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

alter table chapter_clone
    owner to postgres;

grant delete, insert, references, select, trigger, truncate, update on chapter_clone to app_user;

grant delete, insert, references, select, trigger, truncate, update on chapter_clone to dev_user;

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

alter table coupon_restrictions
    owner to postgres;

grant select, update, usage on sequence coupon_restrictions_id_seq to app_user;

grant select, update, usage on sequence coupon_restrictions_id_seq to dev_user;

create index idx_coupon_restrictions_coupon_id
    on coupon_restrictions (coupon_id);

create index idx_coupon_restrictions_course_type
    on coupon_restrictions (restriction_type, is_all_courses);

grant delete, insert, references, select, trigger, truncate, update on coupon_restrictions to app_user;

grant delete, insert, references, select, trigger, truncate, update on coupon_restrictions to dev_user;

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
    study_plan_chips  json,
    instructor_list   json,
    faq_list          json,
    description       varchar(2000),
    feedback_list     json,
    intro_video       varchar(500),
    is_live           boolean,
    serial            integer,
    url               varchar(1000),
    "isActive"        boolean default true not null
);

alter table course
    owner to postgres;

grant select, update, usage on sequence course_id_seq to app_user;

grant select, update, usage on sequence course_id_seq to dev_user;

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

alter table announcements
    owner to postgres;

grant select, update, usage on sequence announcements_id_seq to app_user;

grant select, update, usage on sequence announcements_id_seq to dev_user;

grant delete, insert, references, select, trigger, truncate, update on announcements to app_user;

grant delete, insert, references, select, trigger, truncate, update on announcements to dev_user;

create table bundle_course
(
    course_id integer not null
        references course,
    bundle_id integer not null
        references bundle,
    primary key (course_id, bundle_id)
);

alter table bundle_course
    owner to postgres;

grant delete, insert, references, select, trigger, truncate, update on bundle_course to app_user;

grant delete, insert, references, select, trigger, truncate, update on bundle_course to dev_user;

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

alter table chapter
    owner to postgres;

grant select, update, usage on sequence chapter_id_seq to app_user;

grant select, update, usage on sequence chapter_id_seq to dev_user;

grant delete, insert, references, select, trigger, truncate, update on chapter to app_user;

grant delete, insert, references, select, trigger, truncate, update on chapter to dev_user;

create table course_commissions
(
    id               serial
        primary key,
    item_id          integer                                             not null,
    commission_type  varchar(20) default 'percentage'::character varying not null,
    commission_value numeric(10, 2)                                      not null,
    is_active        boolean     default true,
    created_by       integer,
    created_at       timestamp   default now(),
    updated_at       timestamp   default now(),
    notes            text,
    item_type        varchar(20) default 'course'::character varying     not null
        constraint course_commissions_item_type_check
            check ((item_type)::text = ANY
                   (ARRAY [('course'::character varying)::text, ('bundle'::character varying)::text])),
    content_link     text,
    unique (item_type, item_id)
);

comment on column course_commissions.content_link is 'Google Drive folder link containing marketing materials for ambassadors';

alter table course_commissions
    owner to postgres;

grant select, update, usage on sequence course_commissions_id_seq to app_user;

grant select, update, usage on sequence course_commissions_id_seq to dev_user;

create index idx_course_commissions_active
    on course_commissions (is_active);

create index idx_course_commissions_item
    on course_commissions (item_type, item_id);

create index idx_course_commissions_item_type
    on course_commissions (item_type);

grant delete, insert, references, select, trigger, truncate, update on course_commissions to app_user;

grant delete, insert, references, select, trigger, truncate, update on course_commissions to dev_user;

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

alter table course_routine
    owner to postgres;

grant select, update, usage on sequence course_routine_id_seq to app_user;

grant select, update, usage on sequence course_routine_id_seq to dev_user;

create index idx_routine_active
    on course_routine (course_id, is_active);

create index idx_routine_course_id
    on course_routine (course_id);

create index idx_routine_current_week
    on course_routine (course_id, week_start_date, week_end_date)
    where (is_active = true);

create index idx_routine_week_dates
    on course_routine (week_start_date, week_end_date);

grant delete, insert, references, select, trigger, truncate, update on course_routine to app_user;

grant delete, insert, references, select, trigger, truncate, update on course_routine to dev_user;

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

alter table feedbacks
    owner to postgres;

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

grant delete, insert, references, select, trigger, truncate, update on feedbacks to app_user;

grant delete, insert, references, select, trigger, truncate, update on feedbacks to dev_user;

create table in_auth
(
    id       serial
        primary key,
    name     varchar(100)  not null,
    login    varchar(100)  not null
        unique,
    password varchar(2000) not null
);

alter table in_auth
    owner to postgres;

grant select, update, usage on sequence in_auth_id_seq to app_user;

grant select, update, usage on sequence in_auth_id_seq to dev_user;

grant delete, insert, references, select, trigger, truncate, update on in_auth to app_user;

grant delete, insert, references, select, trigger, truncate, update on in_auth to dev_user;

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

alter table in_pr
    owner to postgres;

grant select, update, usage on sequence in_pr_id_seq to app_user;

grant select, update, usage on sequence in_pr_id_seq to dev_user;

grant delete, insert, references, select, trigger, truncate, update on in_pr to app_user;

grant delete, insert, references, select, trigger, truncate, update on in_pr to dev_user;

create table log
(
    id        serial
        primary key,
    name      varchar not null,
    data      json,
    timestamp integer not null
);

alter table log
    owner to postgres;

grant select, update, usage on sequence log_id_seq to app_user;

grant select, update, usage on sequence log_id_seq to dev_user;

grant delete, insert, references, select, trigger, truncate, update on log to app_user;

grant delete, insert, references, select, trigger, truncate, update on log to dev_user;

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
    is_ambassador boolean   default false,
    is_privileged boolean   default false
);

comment on column managerial_auth.is_privileged is 'Whether teacher has admin panel access (type=2 privilege). If false, teacher exists in platform but has no login access. Teachers are platform-wide entities, not tied to specific courses/bundles.';

alter table managerial_auth
    owner to postgres;

grant select, update, usage on sequence managerial_auth_id_seq to app_user;

grant select, update, usage on sequence managerial_auth_id_seq to dev_user;


create table ambassador_milestones
(
    id           serial
        primary key,
    name         varchar(100)   not null,
    description  text,
    target_type  varchar(20)    not null
        constraint ambassador_milestones_target_type_check
            check ((target_type)::text = ANY
                   (ARRAY [('sales_count'::character varying)::text, ('sales_amount'::character varying)::text])),
    target_value numeric(10, 2) not null,
    bonus_amount numeric(10, 2) not null,
    bonus_type   varchar(20) default 'fixed'::character varying
        constraint ambassador_milestones_bonus_type_check
            check ((bonus_type)::text = ANY
                   (ARRAY [('fixed'::character varying)::text, ('percentage'::character varying)::text])),
    period_type  varchar(20) default 'all_time'::character varying
        constraint ambassador_milestones_period_type_check
            check ((period_type)::text = ANY
                   (ARRAY [('weekly'::character varying)::text, ('monthly'::character varying)::text, ('quarterly'::character varying)::text, ('yearly'::character varying)::text])),
    is_recurring boolean     default false,
    is_active    boolean     default true,
    icon         varchar(50),
    color        varchar(20) default '#4CAF50'::character varying,
    created_by   integer
        references managerial_auth,
    created_at   timestamp   default now(),
    updated_at   timestamp   default now(),
    period_start date,
    period_end   date,
    constraint ambassador_milestones_period_date_pair_check
        check (((period_start IS NULL) AND (period_end IS NULL)) OR
               ((period_start IS NOT NULL) AND (period_end IS NOT NULL) AND (period_start <= period_end)))
);

alter table ambassador_milestones
    owner to postgres;

grant select, update, usage on sequence ambassador_milestones_id_seq to app_user;

grant select, update, usage on sequence ambassador_milestones_id_seq to dev_user;

create index idx_ambassador_milestones_active
    on ambassador_milestones (is_active);

create index idx_ambassador_milestones_period_dates
    on ambassador_milestones (period_start, period_end);

create index idx_ambassador_milestones_type
    on ambassador_milestones (target_type, period_type);

grant delete, insert, references, select, trigger, truncate, update on ambassador_milestones to app_user;

grant delete, insert, references, select, trigger, truncate, update on ambassador_milestones to dev_user;

create table ambassadors
(
    id                      serial
        primary key,
    user_id                 integer                                            not null
        unique
        references managerial_auth
            on delete cascade,
    status                  varchar(20)    default 'active'::character varying not null,
    total_referrals         integer        default 0,
    total_sales             numeric(10, 2) default 0.00,
    total_commission_earned numeric(10, 2) default 0.00,
    total_commission_paid   numeric(10, 2) default 0.00,
    created_by              integer
        references managerial_auth,
    created_at              timestamp      default now(),
    updated_at              timestamp      default now(),
    paused_at               timestamp,
    paused_by               integer
        references managerial_auth,
    paused_reason           text,
    notes                   text,
    university_name         varchar(255),
    department              varchar(255),
    bkash_number            varchar(20),
    nid_document_url        varchar(500),
    profile_picture_url     varchar(500),
    referral_source         text,
    additional_info         jsonb          default '{}'::jsonb,
    platforms_updated_at    timestamp,
    is_profile_completed    boolean        default false,
    approved_by             integer
        references managerial_auth,
    approved_at             timestamp,
    rejected_by             integer
        references managerial_auth,
    rejected_at             timestamp,
    rejection_reason        text,
    current_tier_id         integer
        references ambassador_tiers,
    tier_upgraded_at        timestamp,
    tier_override_by        integer
        references managerial_auth
);

alter table ambassadors
    owner to postgres;

grant select, update, usage on sequence ambassadors_id_seq to app_user;

grant select, update, usage on sequence ambassadors_id_seq to dev_user;

create table ambassador_milestone_progress
(
    id                  serial
        primary key,
    ambassador_id       integer        not null
        references ambassadors
            on delete cascade,
    milestone_id        integer        not null
        references ambassador_milestones
            on delete cascade,
    current_value       numeric(10, 2) default 0,
    target_value        numeric(10, 2) not null,
    progress_percentage numeric(5, 2)  default 0,
    achieved_at         timestamp,
    bonus_paid          boolean        default false,
    bonus_paid_at       timestamp,
    period_start        date,
    period_end          date,
    created_at          timestamp      default now(),
    updated_at          timestamp      default now(),
    constraint ambassador_milestone_progress_ambassador_id_milestone_id_pe_key
        unique (ambassador_id, milestone_id, period_start)
);

alter table ambassador_milestone_progress
    owner to postgres;

grant select, update, usage on sequence ambassador_milestone_progress_id_seq to app_user;

grant select, update, usage on sequence ambassador_milestone_progress_id_seq to dev_user;

create index idx_milestone_progress_achieved
    on ambassador_milestone_progress (achieved_at)
    where (achieved_at IS NOT NULL);

create index idx_milestone_progress_ambassador
    on ambassador_milestone_progress (ambassador_id);

create index idx_milestone_progress_milestone
    on ambassador_milestone_progress (milestone_id);

create index idx_milestone_progress_pending_bonus
    on ambassador_milestone_progress (bonus_paid)
    where ((bonus_paid = false) AND (achieved_at IS NOT NULL));

grant delete, insert, references, select, trigger, truncate, update on ambassador_milestone_progress to app_user;

grant delete, insert, references, select, trigger, truncate, update on ambassador_milestone_progress to dev_user;

create table ambassador_payments
(
    id                serial
        primary key,
    ambassador_id     integer        not null
        references ambassadors
            on delete cascade,
    amount            numeric(10, 2) not null,
    payment_method    varchar(50)    not null
        constraint ambassador_payments_payment_method_check
            check ((payment_method)::text = ANY
                   (ARRAY [('bkash'::character varying)::text, ('nagad'::character varying)::text, ('rocket'::character varying)::text, ('bank_transfer'::character varying)::text, ('cash'::character varying)::text, ('other'::character varying)::text])),
    payment_reference varchar(100),
    period_start      date,
    period_end        date,
    status            varchar(20) default 'pending'::character varying
        constraint ambassador_payments_status_check
            check ((status)::text = ANY
                   (ARRAY [('pending'::character varying)::text, ('processing'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('cancelled'::character varying)::text])),
    processed_by      integer
        references managerial_auth,
    processed_at      timestamp,
    notes             text,
    commission_ids    integer[],
    created_at        timestamp   default now(),
    updated_at        timestamp   default now()
);

alter table ambassador_payments
    owner to postgres;

grant select, update, usage on sequence ambassador_payments_id_seq to app_user;

grant select, update, usage on sequence ambassador_payments_id_seq to dev_user;

create index idx_ambassador_payments_ambassador
    on ambassador_payments (ambassador_id);

create index idx_ambassador_payments_date
    on ambassador_payments (created_at desc);

create index idx_ambassador_payments_method
    on ambassador_payments (payment_method);

create index idx_ambassador_payments_status
    on ambassador_payments (status);

grant delete, insert, references, select, trigger, truncate, update on ambassador_payments to app_user;

grant delete, insert, references, select, trigger, truncate, update on ambassador_payments to dev_user;

create index idx_ambassadors_created_at
    on ambassadors (created_at);

create index idx_ambassadors_department
    on ambassadors (department);

create index idx_ambassadors_profile_completed
    on ambassadors (is_profile_completed);

create index idx_ambassadors_status
    on ambassadors (status);

create index idx_ambassadors_university
    on ambassadors (university_name);

create index idx_ambassadors_user_id
    on ambassadors (user_id);

grant delete, insert, references, select, trigger, truncate, update on ambassadors to app_user;

grant delete, insert, references, select, trigger, truncate, update on ambassadors to dev_user;

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

alter table bundle_instructor
    owner to postgres;

grant select, update, usage on sequence bundle_instructor_id_seq to app_user;

grant select, update, usage on sequence bundle_instructor_id_seq to dev_user;

create index idx_bundle_instructor_bundle_id
    on bundle_instructor (bundle_id);

create index idx_bundle_instructor_instructor_id
    on bundle_instructor (instructor_id);

grant delete, insert, references, select, trigger, truncate, update on bundle_instructor to app_user;

grant delete, insert, references, select, trigger, truncate, update on bundle_instructor to dev_user;

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

alter table coupons
    owner to postgres;

grant select, update, usage on sequence coupons_id_seq to app_user;

grant select, update, usage on sequence coupons_id_seq to dev_user;

create table ambassador_coupons
(
    id            serial
        primary key,
    ambassador_id integer not null
        references ambassadors
            on delete cascade,
    coupon_id     integer not null
        references coupons
            on delete cascade,
    assigned_by   integer
        references managerial_auth,
    assigned_at   timestamp default now(),
    is_active     boolean   default true,
    notes         text,
    unique (ambassador_id, coupon_id)
);

alter table ambassador_coupons
    owner to postgres;

grant select, update, usage on sequence ambassador_coupons_id_seq to app_user;

grant select, update, usage on sequence ambassador_coupons_id_seq to dev_user;

create index idx_ambassador_coupons_ambassador_id
    on ambassador_coupons (ambassador_id);

create index idx_ambassador_coupons_coupon_id
    on ambassador_coupons (coupon_id);

create index idx_ambassador_coupons_is_active
    on ambassador_coupons (is_active);

grant delete, insert, references, select, trigger, truncate, update on ambassador_coupons to app_user;

grant delete, insert, references, select, trigger, truncate, update on ambassador_coupons to dev_user;

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

alter table bundle_purchase
    owner to postgres;

grant select, update, usage on sequence bundle_purchase_id_seq to app_user;

grant select, update, usage on sequence bundle_purchase_id_seq to dev_user;

create index idx_bundle_purchase_bundle_id
    on bundle_purchase (bundle_id);

create index idx_bundle_purchase_user_id
    on bundle_purchase (user_id);

grant delete, insert, references, select, trigger, truncate, update on bundle_purchase to app_user;

grant delete, insert, references, select, trigger, truncate, update on bundle_purchase to dev_user;

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

alter table coupon_bundles
    owner to postgres;

grant select, update, usage on sequence coupon_bundles_id_seq to app_user;

grant select, update, usage on sequence coupon_bundles_id_seq to dev_user;

create index idx_coupon_bundles_bundle_id
    on coupon_bundles (bundle_id);

create index idx_coupon_bundles_coupon_id
    on coupon_bundles (coupon_id);

grant delete, insert, references, select, trigger, truncate, update on coupon_bundles to app_user;

grant delete, insert, references, select, trigger, truncate, update on coupon_bundles to dev_user;

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

alter table coupon_courses
    owner to postgres;

grant select, update, usage on sequence coupon_courses_id_seq to app_user;

grant select, update, usage on sequence coupon_courses_id_seq to dev_user;

create index idx_coupon_courses_coupon_id
    on coupon_courses (coupon_id);

create index idx_coupon_courses_course_id
    on coupon_courses (course_id);

grant delete, insert, references, select, trigger, truncate, update on coupon_courses to app_user;

grant delete, insert, references, select, trigger, truncate, update on coupon_courses to dev_user;

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
    transaction_id       varchar(255),
    ambassador_id        integer
                                        references ambassadors
                                            on delete set null,
    commission_generated numeric(10, 2) default 0.00
);

alter table coupon_usage
    owner to postgres;

grant select, update, usage on sequence coupon_usage_id_seq to app_user;

grant select, update, usage on sequence coupon_usage_id_seq to dev_user;

create table ambassador_commissions
(
    id                serial
        primary key,
    ambassador_id     integer        not null
        references ambassadors
            on delete cascade,
    coupon_usage_id   integer
                                     references coupon_usage
                                         on delete set null,
    user_id           integer        not null
        references managerial_auth,
    purchase_type     varchar(20)    not null,
    purchase_id       integer        not null,
    purchase_amount   numeric(10, 2) not null,
    commission_rate   numeric(5, 2)  not null,
    commission_amount numeric(10, 2) not null,
    payment_status    varchar(20) default 'pending'::character varying,
    paid_at           timestamp,
    paid_by           integer
        references managerial_auth,
    payment_method    varchar(50),
    payment_reference varchar(255),
    created_at        timestamp   default now(),
    notes             text,
    coupon_id         integer
                                     references coupons
                                         on delete set null,
    commission_type   varchar(20) default 'percentage'::character varying,
    metadata          jsonb
);

alter table ambassador_commissions
    owner to postgres;

grant select, update, usage on sequence ambassador_commissions_id_seq to app_user;

grant select, update, usage on sequence ambassador_commissions_id_seq to dev_user;

create index idx_ambassador_commissions_ambassador_id
    on ambassador_commissions (ambassador_id);

create index idx_ambassador_commissions_coupon_id
    on ambassador_commissions (coupon_id);

create index idx_ambassador_commissions_created_at
    on ambassador_commissions (created_at);

create index idx_ambassador_commissions_payment_status
    on ambassador_commissions (payment_status);

create index idx_ambassador_commissions_user_id
    on ambassador_commissions (user_id);

grant delete, insert, references, select, trigger, truncate, update on ambassador_commissions to app_user;

grant delete, insert, references, select, trigger, truncate, update on ambassador_commissions to dev_user;

create table coupon_clicks
(
    id                    serial
        primary key,
    coupon_id             integer not null
        references coupons
            on delete cascade,
    ambassador_id         integer
                                  references ambassadors
                                      on delete set null,
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

alter table coupon_clicks
    owner to postgres;

grant select, update, usage on sequence coupon_clicks_id_seq to app_user;

grant select, update, usage on sequence coupon_clicks_id_seq to dev_user;

create index idx_coupon_clicks_ambassador_coupon
    on coupon_clicks (ambassador_id, coupon_id);

create index idx_coupon_clicks_ambassador_id
    on coupon_clicks (ambassador_id);

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

grant delete, insert, references, select, trigger, truncate, update on coupon_clicks to app_user;

grant delete, insert, references, select, trigger, truncate, update on coupon_clicks to dev_user;

create index idx_coupon_usage_ambassador_id
    on coupon_usage (ambassador_id);

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

grant delete, insert, references, select, trigger, truncate, update on coupon_usage to app_user;

grant delete, insert, references, select, trigger, truncate, update on coupon_usage to dev_user;

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

grant delete, insert, references, select, trigger, truncate, update on coupons to app_user;

grant delete, insert, references, select, trigger, truncate, update on coupons to dev_user;

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

alter table course_import_tracking
    owner to postgres;

grant select, update, usage on sequence course_import_tracking_id_seq to app_user;

grant select, update, usage on sequence course_import_tracking_id_seq to dev_user;

create index idx_import_tracking_course_id
    on course_import_tracking (course_id);

create index idx_import_tracking_created_by
    on course_import_tracking (created_by);

create index idx_import_tracking_import_id
    on course_import_tracking (import_id);

create index idx_import_tracking_status
    on course_import_tracking (status);

grant delete, insert, references, select, trigger, truncate, update on course_import_tracking to app_user;

grant delete, insert, references, select, trigger, truncate, update on course_import_tracking to dev_user;

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

alter table instructor
    owner to postgres;

grant delete, insert, references, select, trigger, truncate, update on instructor to app_user;

grant delete, insert, references, select, trigger, truncate, update on instructor to dev_user;

create index idx_is_ambassador
    on managerial_auth (is_ambassador)
    where (is_ambassador = true);

create index idx_managerial_auth_email
    on managerial_auth (email)
    where (email IS NOT NULL);

create index idx_managerial_auth_is_privileged
    on managerial_auth (is_privileged);

create index idx_managerial_auth_phone
    on managerial_auth (phone)
    where (phone IS NOT NULL);

grant delete, insert, references, select, trigger, truncate, update on managerial_auth to app_user;

grant delete, insert, references, select, trigger, truncate, update on managerial_auth to dev_user;

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

alter table module
    owner to postgres;

grant select, update, usage on sequence module_id_seq to app_user;

grant select, update, usage on sequence module_id_seq to dev_user;

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

alter table assignment
    owner to postgres;

grant select, update, usage on sequence assignment_id_seq to app_user;

grant select, update, usage on sequence assignment_id_seq to dev_user;

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

grant delete, insert, references, select, trigger, truncate, update on assignment to app_user;

grant delete, insert, references, select, trigger, truncate, update on assignment to dev_user;

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

alter table compilation
    owner to postgres;

grant select, update, usage on sequence compilation_id_seq to app_user;

grant select, update, usage on sequence compilation_id_seq to dev_user;

grant delete, insert, references, select, trigger, truncate, update on compilation to app_user;

grant delete, insert, references, select, trigger, truncate, update on compilation to dev_user;

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

alter table editorial_view
    owner to postgres;

grant delete, insert, references, select, trigger, truncate, update on editorial_view to app_user;

grant delete, insert, references, select, trigger, truncate, update on editorial_view to dev_user;

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

grant delete, insert, references, select, trigger, truncate, update on module to app_user;

grant delete, insert, references, select, trigger, truncate, update on module to dev_user;

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

alter table module_clone
    owner to postgres;

grant delete, insert, references, select, trigger, truncate, update on module_clone to app_user;

grant delete, insert, references, select, trigger, truncate, update on module_clone to dev_user;

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

alter table module_feedback_reasons
    owner to postgres;

grant select, update, usage on sequence module_feedback_reasons_id_seq to app_user;

grant select, update, usage on sequence module_feedback_reasons_id_seq to dev_user;

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

alter table module_feedback
    owner to postgres;

grant select, update, usage on sequence module_feedback_id_seq to app_user;

grant select, update, usage on sequence module_feedback_id_seq to dev_user;

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

grant delete, insert, references, select, trigger, truncate, update on module_feedback to app_user;

grant delete, insert, references, select, trigger, truncate, update on module_feedback to dev_user;

create index idx_module_feedback_reasons_active
    on module_feedback_reasons (is_active);

create index idx_module_feedback_reasons_key
    on module_feedback_reasons (reason_key);

grant delete, insert, references, select, trigger, truncate, update on module_feedback_reasons to app_user;

grant delete, insert, references, select, trigger, truncate, update on module_feedback_reasons to dev_user;

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

alter table notification
    owner to postgres;

grant select, update, usage on sequence notification_id_seq to app_user;

grant select, update, usage on sequence notification_id_seq to dev_user;

create index idx_notification_delivery_channel
    on notification (user_id asc, delivery_channel asc, timestamp desc);

create index idx_notification_unread_count
    on notification (user_id asc, is_read asc, timestamp desc)
    where (is_read = false);

grant delete, insert, references, select, trigger, truncate, update on notification to app_user;

grant delete, insert, references, select, trigger, truncate, update on notification to dev_user;

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

alter table notification_event_channel_config
    owner to postgres;

grant select, update, usage on sequence notification_event_channel_config_id_seq to app_user;

grant select, update, usage on sequence notification_event_channel_config_id_seq to dev_user;

create index idx_notification_event_channel_config_event
    on notification_event_channel_config (event_code);

create index idx_notification_event_channel_config_lookup
    on notification_event_channel_config (event_code, channel)
    where (is_enabled = true);

grant delete, insert, references, select, trigger, truncate, update on notification_event_channel_config to app_user;

grant delete, insert, references, select, trigger, truncate, update on notification_event_channel_config to dev_user;

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

alter table notification_jobs
    owner to postgres;

grant select, update, usage on sequence notification_jobs_id_seq to app_user;

grant select, update, usage on sequence notification_jobs_id_seq to dev_user;

create index idx_notification_jobs_status_next_retry
    on notification_jobs (status, next_retry_at)
    where ((status)::text = ANY (ARRAY [('pending'::character varying)::text, ('failed'::character varying)::text]));

grant delete, insert, references, select, trigger, truncate, update on notification_jobs to app_user;

grant delete, insert, references, select, trigger, truncate, update on notification_jobs to dev_user;

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

alter table notification_log
    owner to postgres;

grant select, update, usage on sequence notification_log_id_seq to app_user;

grant select, update, usage on sequence notification_log_id_seq to dev_user;

create index idx_notification_log_event_channel_created
    on notification_log (event_code, channel, created_at);

create unique index idx_notification_log_idempotency_key
    on notification_log (idempotency_key)
    where (idempotency_key IS NOT NULL);

create index idx_notification_log_recipient_id
    on notification_log (recipient_id);

grant delete, insert, references, select, trigger, truncate, update on notification_log to app_user;

grant delete, insert, references, select, trigger, truncate, update on notification_log to dev_user;

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

alter table notification_providers
    owner to postgres;

grant select, update, usage on sequence notification_providers_id_seq to app_user;

grant select, update, usage on sequence notification_providers_id_seq to dev_user;

create index idx_notification_providers_channel_default
    on notification_providers (channel, is_default);

grant delete, insert, references, select, trigger, truncate, update on notification_providers to app_user;

grant delete, insert, references, select, trigger, truncate, update on notification_providers to dev_user;

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

alter table notification_templates
    owner to postgres;

grant select, update, usage on sequence notification_templates_id_seq to app_user;

grant select, update, usage on sequence notification_templates_id_seq to dev_user;

create unique index idx_notification_templates_code_channel
    on notification_templates (code, channel);

grant delete, insert, references, select, trigger, truncate, update on notification_templates to app_user;

grant delete, insert, references, select, trigger, truncate, update on notification_templates to dev_user;

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

alter table otp
    owner to postgres;

grant select, update, usage on sequence otp_id_seq to app_user;

grant select, update, usage on sequence otp_id_seq to dev_user;

grant delete, insert, references, select, trigger, truncate, update on otp to app_user;

grant delete, insert, references, select, trigger, truncate, update on otp to dev_user;

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

alter table payment_audit_log
    owner to postgres;

grant select, update, usage on sequence payment_audit_log_id_seq to app_user;

grant select, update, usage on sequence payment_audit_log_id_seq to dev_user;

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

grant delete, insert, references, select, trigger, truncate, update on payment_audit_log to app_user;

grant delete, insert, references, select, trigger, truncate, update on payment_audit_log to dev_user;

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

alter table payment_coupon_tracking
    owner to postgres;

grant select, update, usage on sequence payment_coupon_tracking_id_seq to app_user;

grant select, update, usage on sequence payment_coupon_tracking_id_seq to dev_user;

create index idx_payment_coupon_tracking_expires_at
    on payment_coupon_tracking (expires_at);

create index idx_payment_coupon_tracking_transaction_id
    on payment_coupon_tracking (transaction_id);

grant delete, insert, references, select, trigger, truncate, update on payment_coupon_tracking to app_user;

grant delete, insert, references, select, trigger, truncate, update on payment_coupon_tracking to dev_user;

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

alter table prebooking
    owner to postgres;

grant select, update, usage on sequence prebooking_id_seq to app_user;

grant select, update, usage on sequence prebooking_id_seq to dev_user;

grant delete, insert, references, select, trigger, truncate, update on prebooking to app_user;

grant delete, insert, references, select, trigger, truncate, update on prebooking to dev_user;

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

alter table prebooking_bundle
    owner to postgres;

grant select, update, usage on sequence prebooking_bundle_id_seq to app_user;

grant select, update, usage on sequence prebooking_bundle_id_seq to dev_user;

grant delete, insert, references, select, trigger, truncate, update on prebooking_bundle to app_user;

grant delete, insert, references, select, trigger, truncate, update on prebooking_bundle to dev_user;

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

alter table progress
    owner to postgres;

grant delete, insert, references, select, trigger, truncate, update on progress to app_user;

grant delete, insert, references, select, trigger, truncate, update on progress to dev_user;

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

alter table public_notifications
    owner to postgres;

grant select, update, usage on sequence public_notifications_id_seq to app_user;

grant select, update, usage on sequence public_notifications_id_seq to dev_user;

create index idx_public_notifications_active_list
    on public_notifications (is_active asc, priority desc, created_at desc)
    where (is_active = true);

create index idx_public_notifications_created_by
    on public_notifications (created_by asc, created_at desc);

grant delete, insert, references, select, trigger, truncate, update on public_notifications to app_user;

grant delete, insert, references, select, trigger, truncate, update on public_notifications to dev_user;

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

alter table roles
    owner to postgres;

grant select, update, usage on sequence roles_id_seq to app_user;

grant select, update, usage on sequence roles_id_seq to dev_user;

create index idx_roles_name
    on roles (name);

create index idx_roles_permissions
    on roles using gin (permissions);

grant delete, insert, references, select, trigger, truncate, update on roles to app_user;

grant delete, insert, references, select, trigger, truncate, update on roles to dev_user;

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

alter table sms_history
    owner to postgres;

grant select, update, usage on sequence sms_history_id_seq to app_user;

grant select, update, usage on sequence sms_history_id_seq to dev_user;

create index idx_sms_history_class_id
    on sms_history (class_id);

create index idx_sms_history_course_id
    on sms_history (course_id);

grant delete, insert, references, select, trigger, truncate, update on sms_history to app_user;

grant delete, insert, references, select, trigger, truncate, update on sms_history to dev_user;

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

alter table sms_recipients
    owner to postgres;

grant select, update, usage on sequence sms_recipients_id_seq to app_user;

grant select, update, usage on sequence sms_recipients_id_seq to dev_user;

create index idx_sms_recipients_sms_id
    on sms_recipients (sms_id);

create index idx_sms_recipients_student_id
    on sms_recipients (student_id);

grant delete, insert, references, select, trigger, truncate, update on sms_recipients to app_user;

grant delete, insert, references, select, trigger, truncate, update on sms_recipients to dev_user;

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

alter table submission
    owner to postgres;

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

alter table assignment_files
    owner to postgres;

grant select, update, usage on sequence assignment_files_id_seq to app_user;

grant select, update, usage on sequence assignment_files_id_seq to dev_user;

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

grant delete, insert, references, select, trigger, truncate, update on assignment_files to app_user;

grant delete, insert, references, select, trigger, truncate, update on assignment_files to dev_user;

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

grant delete, insert, references, select, trigger, truncate, update on submission to app_user;

grant delete, insert, references, select, trigger, truncate, update on submission to dev_user;

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

alter table takes
    owner to postgres;

create index idx_takes_coupon_id
    on takes (coupon_id);

grant delete, insert, references, select, trigger, truncate, update on takes to app_user;

grant delete, insert, references, select, trigger, truncate, update on takes to dev_user;

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

alter table transaction_logs
    owner to postgres;

grant select, update, usage on sequence transaction_logs_id_seq to app_user;

grant select, update, usage on sequence transaction_logs_id_seq to dev_user;

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

grant delete, insert, references, select, trigger, truncate, update on transaction_logs to app_user;

grant delete, insert, references, select, trigger, truncate, update on transaction_logs to dev_user;

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

alter table user_course_streaks
    owner to postgres;

create index idx_course_streaks
    on user_course_streaks (course_id);

create index idx_last_activity
    on user_course_streaks (last_activity_date desc);

create index idx_longest_streaks
    on user_course_streaks (longest_streak desc);

create index idx_user_streaks
    on user_course_streaks (user_id);

grant delete, insert, references, select, trigger, truncate, update on user_course_streaks to app_user;

grant delete, insert, references, select, trigger, truncate, update on user_course_streaks to dev_user;

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

alter table user_module_views
    owner to postgres;

grant select, update, usage on sequence user_module_views_id_seq to app_user;

grant select, update, usage on sequence user_module_views_id_seq to dev_user;

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

grant delete, insert, references, select, trigger, truncate, update on user_module_views to app_user;

grant delete, insert, references, select, trigger, truncate, update on user_module_views to dev_user;

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

alter table user_roles
    owner to postgres;

grant select, update, usage on sequence user_roles_id_seq to app_user;

grant select, update, usage on sequence user_roles_id_seq to dev_user;

create index idx_user_roles_role_id
    on user_roles (role_id);

create index idx_user_roles_updated_by
    on user_roles (updated_by);

create index idx_user_roles_user_id
    on user_roles (user_id);

grant delete, insert, references, select, trigger, truncate, update on user_roles to app_user;

grant delete, insert, references, select, trigger, truncate, update on user_roles to dev_user;







create function deactivate_ambassador_coupons() returns trigger
    language plpgsql
as
$$
    BEGIN
        -- Set all coupons linked to this ambassador to inactive
        UPDATE coupons 
        SET status = 'inactive',
            updated_at = EXTRACT(EPOCH FROM NOW())::INTEGER
        WHERE id IN (
            SELECT coupon_id 
            FROM ambassador_coupons 
            WHERE ambassador_id = OLD.id
        );
        
        RAISE NOTICE 'Deactivated coupons for ambassador ID: %', OLD.id;
        
        RETURN OLD;
    END;
    $$;

alter function deactivate_ambassador_coupons() owner to postgres;

grant execute on function deactivate_ambassador_coupons() to app_user;

grant execute on function deactivate_ambassador_coupons() to dev_user;

create function get_ambassador_tier(sales_count integer) returns integer
    language plpgsql
as
$$
    DECLARE
        tier_id INTEGER;
    BEGIN
        SELECT id INTO tier_id
        FROM ambassador_tiers
        WHERE is_active = true
          AND sales_count >= min_sales
          AND (max_sales IS NULL OR sales_count <= max_sales)
        ORDER BY min_sales DESC
        LIMIT 1;
        
        RETURN tier_id;
    END;
    $$;

alter function get_ambassador_tier(integer) owner to postgres;

grant execute on function get_ambassador_tier(integer) to app_user;

grant execute on function get_ambassador_tier(integer) to dev_user;

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

alter function get_user_permissions(integer) owner to postgres;

grant execute on function get_user_permissions(integer) to app_user;

grant execute on function get_user_permissions(integer) to dev_user;

create function update_ambassador_course_commission_timestamp() returns trigger
    language plpgsql
as
$$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$;

alter function update_ambassador_course_commission_timestamp() owner to postgres;

grant execute on function update_ambassador_course_commission_timestamp() to app_user;

grant execute on function update_ambassador_course_commission_timestamp() to dev_user;

create function update_ambassador_milestones_timestamp() returns trigger
    language plpgsql
as
$$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$;

alter function update_ambassador_milestones_timestamp() owner to postgres;

grant execute on function update_ambassador_milestones_timestamp() to app_user;

grant execute on function update_ambassador_milestones_timestamp() to dev_user;

create function update_ambassador_payments_timestamp() returns trigger
    language plpgsql
as
$$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$;

alter function update_ambassador_payments_timestamp() owner to postgres;

grant execute on function update_ambassador_payments_timestamp() to app_user;

grant execute on function update_ambassador_payments_timestamp() to dev_user;

create function update_ambassador_stats() returns trigger
    language plpgsql
as
$$
    DECLARE
        v_ambassador_id INTEGER;
    BEGIN
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            -- Determine ambassador_id: use NEW.ambassador_id if set, otherwise look up from ambassador_coupons
            IF NEW.ambassador_id IS NOT NULL THEN
                v_ambassador_id := NEW.ambassador_id;
            ELSIF NEW.coupon_id IS NOT NULL THEN
                -- Look up ambassador_id from ambassador_coupons
                SELECT ambassador_id INTO v_ambassador_id
                FROM ambassador_coupons
                WHERE coupon_id = NEW.coupon_id 
                  AND is_active = true
                LIMIT 1;
            END IF;
            
            -- Only update if we found an ambassador_id
            IF v_ambassador_id IS NOT NULL THEN
                UPDATE ambassadors
                SET 
                    -- FIX: Use COUNT(id) for total purchases, not COUNT(DISTINCT user_id) for unique users
                    total_referrals = (
                        SELECT COUNT(cu.id)
                        FROM coupon_usage cu
                        LEFT JOIN ambassador_coupons ac ON cu.coupon_id = ac.coupon_id AND ac.is_active = true
                        WHERE COALESCE(cu.ambassador_id, ac.ambassador_id) = v_ambassador_id
                          AND cu.payment_status = 'completed'
                    ),
                    total_sales = (
                        SELECT COALESCE(SUM(cu.final_price), 0)
                        FROM coupon_usage cu
                        LEFT JOIN ambassador_coupons ac ON cu.coupon_id = ac.coupon_id AND ac.is_active = true
                        WHERE COALESCE(cu.ambassador_id, ac.ambassador_id) = v_ambassador_id
                          AND cu.payment_status = 'completed'
                    ),
                    total_commission_earned = (
                        SELECT COALESCE(SUM(commission_amount), 0)
                        FROM ambassador_commissions
                        WHERE ambassador_id = v_ambassador_id
                    ),
                    total_commission_paid = (
                        SELECT COALESCE(SUM(commission_amount), 0)
                        FROM ambassador_commissions
                        WHERE ambassador_id = v_ambassador_id
                          AND payment_status = 'paid'
                    ),
                    updated_at = NOW()
                WHERE id = v_ambassador_id;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$;

alter function update_ambassador_stats() owner to postgres;

grant execute on function update_ambassador_stats() to app_user;

grant execute on function update_ambassador_stats() to dev_user;

create function update_ambassador_tiers_timestamp() returns trigger
    language plpgsql
as
$$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$;

alter function update_ambassador_tiers_timestamp() owner to postgres;

grant execute on function update_ambassador_tiers_timestamp() to app_user;

grant execute on function update_ambassador_tiers_timestamp() to dev_user;

create function update_assignment_updated_at() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

alter function update_assignment_updated_at() owner to postgres;

grant execute on function update_assignment_updated_at() to app_user;

grant execute on function update_assignment_updated_at() to dev_user;

create function update_course_commission_timestamp() returns trigger
    language plpgsql
as
$$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$;

alter function update_course_commission_timestamp() owner to postgres;

grant execute on function update_course_commission_timestamp() to app_user;

grant execute on function update_course_commission_timestamp() to dev_user;

create function update_course_routine_timestamp() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

alter function update_course_routine_timestamp() owner to postgres;

grant execute on function update_course_routine_timestamp() to app_user;

grant execute on function update_course_routine_timestamp() to dev_user;

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

alter function update_device_last_seen() owner to postgres;

grant execute on function update_device_last_seen() to app_user;

grant execute on function update_device_last_seen() to dev_user;

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

alter function update_milestone_progress_timestamp() owner to postgres;

grant execute on function update_milestone_progress_timestamp() to app_user;

grant execute on function update_milestone_progress_timestamp() to dev_user;

create function update_module_feedback_reasons_updated_at() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

alter function update_module_feedback_reasons_updated_at() owner to postgres;

grant execute on function update_module_feedback_reasons_updated_at() to app_user;

grant execute on function update_module_feedback_reasons_updated_at() to dev_user;

create function update_module_feedback_updated_at() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

alter function update_module_feedback_updated_at() owner to postgres;

grant execute on function update_module_feedback_updated_at() to app_user;

grant execute on function update_module_feedback_updated_at() to dev_user;

create function update_updated_at_column() returns trigger
    language plpgsql
as
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

alter function update_updated_at_column() owner to postgres;

grant execute on function update_updated_at_column() to app_user;

grant execute on function update_updated_at_column() to dev_user;
