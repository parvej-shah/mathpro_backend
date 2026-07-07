-- Adds book-scoping for coupons (mirrors coupon_courses / coupon_bundles) and a
-- book_id column on coupon_usage so a standalone book purchase can use coupons
-- through the same generic itemType/itemConfig machinery.

create table coupon_books
(
    id         serial
        primary key,
    coupon_id  integer
        references coupons
            on delete cascade,
    book_id    integer
        references book
            on delete cascade,
    created_at integer not null,
    unique (coupon_id, book_id)
);

create index idx_coupon_books_book_id
    on coupon_books (book_id);

create index idx_coupon_books_coupon_id
    on coupon_books (coupon_id);

alter table coupon_usage
    add column book_id integer references book;

create index idx_coupon_usage_book_id
    on coupon_usage (book_id);

alter table coupon_clicks
    add column book_id integer references book on delete set null;

create index idx_coupon_clicks_book_id
    on coupon_clicks (book_id);
