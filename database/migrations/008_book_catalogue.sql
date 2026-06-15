-- Migration 008: Book Catalogue + optional book-with-course/bundle purchase
-- Adds an admin-managed catalogue of physical books, a many-to-many link to
-- courses, transaction-keyed staging for the book selection captured at payment
-- initiation, and a confirmed-purchase table written by the IPN handler.

-- 1. Catalogue of books
CREATE TABLE IF NOT EXISTS book (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(1000) NOT NULL,
    image_url     VARCHAR(1000),               -- S3 image link (URL only)
    description   VARCHAR(2000),
    class_levels  JSON,                         -- e.g. ["Class 8","Class 9-10"]
    tags          JSON,                         -- array of tag strings/objects
    price         INTEGER NOT NULL DEFAULT 0,   -- BDT, same convention as course.price
    is_active     BOOLEAN DEFAULT TRUE,
    created_by    INTEGER REFERENCES managerial_auth,
    created_at    INTEGER,                      -- unix seconds (project convention)
    updated_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_book_is_active ON book(is_active);

-- 2. Many-to-many: which books a course offers
CREATE TABLE IF NOT EXISTS course_book (
    course_id INTEGER NOT NULL REFERENCES course ON DELETE CASCADE,
    book_id   INTEGER NOT NULL REFERENCES book   ON DELETE CASCADE,
    PRIMARY KEY (course_id, book_id)
);

-- 3. Staging: book selection captured at payment initiation (course OR bundle),
--    keyed by transaction_id, read back in IPN (mirrors payment_coupon_tracking)
CREATE TABLE IF NOT EXISTS payment_book_selection (
    id             SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    user_id        INTEGER REFERENCES managerial_auth,
    item_type      VARCHAR(20) NOT NULL,         -- 'COURSE' | 'BUNDLE'
    item_id        INTEGER NOT NULL,             -- course_id or bundle_id
    books_total    INTEGER NOT NULL DEFAULT 0,   -- sum of selected book prices
    book_ids       JSON,                         -- snapshot of included book ids
    ship_name      VARCHAR(255),
    ship_phone     VARCHAR(50),
    ship_address   VARCHAR(1000),
    ship_city      VARCHAR(255),
    ship_postcode  VARCHAR(50),
    created_at     INTEGER
);

-- 4. Confirmed purchase of physical books (written in IPN on success).
--    course_id is the course the book came from; for bundle purchases bundle_id
--    is also set so the admin can group/fulfil the order.
CREATE TABLE IF NOT EXISTS course_book_purchase (
    id                 SERIAL PRIMARY KEY,
    user_id            INTEGER NOT NULL REFERENCES managerial_auth ON DELETE CASCADE,
    course_id          INTEGER REFERENCES course,
    bundle_id          INTEGER REFERENCES bundle,    -- set when bought via a bundle
    book_id            INTEGER NOT NULL REFERENCES book,
    amount_paid        INTEGER,                       -- price snapshot for this book
    transaction_id     VARCHAR(255),
    ship_name          VARCHAR(255),
    ship_phone         VARCHAR(50),
    ship_address       VARCHAR(1000),
    ship_city          VARCHAR(255),
    ship_postcode      VARCHAR(50),
    fulfillment_status VARCHAR(30) DEFAULT 'pending', -- pending|shipped|delivered|cancelled
    timestamp          INTEGER
);
CREATE INDEX IF NOT EXISTS idx_course_book_purchase_user ON course_book_purchase(user_id);
CREATE INDEX IF NOT EXISTS idx_course_book_purchase_status ON course_book_purchase(fulfillment_status);
-- Guard IPN idempotency: one row per (transaction, book)
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_book_purchase_txn_book
    ON course_book_purchase(transaction_id, book_id);
