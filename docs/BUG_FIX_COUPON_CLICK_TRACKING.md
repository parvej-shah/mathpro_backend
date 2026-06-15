# Bug Fix: Coupon Click Tracking Purchase Linking

**Date:** 2026-03-01  
**Status:** FIXED  
**Severity:** CRITICAL

## Problem Summary

The coupon click tracking system was recording clicks correctly but **failing to link them to completed purchases**. This resulted in:
- 26 total clicks recorded
- 18 completed purchases in the database
- **0 clicks marked as `purchase_completed = TRUE`**
- All conversion rates showing 0%
- No revenue tracking for coupon performance

## Root Cause

**SQL Syntax Error in `linkClickToPurchase` function** (service/managerial/coupon.js, line ~1505-1555)

The function attempted to use `ORDER BY` and `LIMIT` clauses in an UPDATE statement:

```sql
UPDATE coupon_clicks
SET ...
WHERE ...
ORDER BY clicked_at DESC  -- ❌ NOT SUPPORTED IN PostgreSQL UPDATE
LIMIT 1                    -- ❌ NOT SUPPORTED IN PostgreSQL UPDATE
RETURNING id
```

PostgreSQL does not support `ORDER BY` and `LIMIT` in UPDATE statements, causing the query to fail with:
```
error: syntax error at or near "ORDER"
```

This error was caught in the try-catch block and returned as a "success: true, linked: false" response, making it appear as if no matching click was found rather than revealing the SQL error.

## Impact

1. **All purchase linking failed** since the feature was implemented
2. **Analytics were incorrect**:
   - Conversion rates showed 0% instead of actual rates (e.g., 57.14% for coupon 66)
   - Revenue tracking showed ৳0 instead of actual revenue
   - Purchase completion counts were all 0
3. **Business decisions** based on coupon performance data were based on incorrect metrics

## Solution

### 1. Fixed the `linkClickToPurchase` Function

Changed the approach from a single UPDATE query to a two-step process:

**Before (Broken):**
```javascript
// Try to UPDATE with ORDER BY and LIMIT (fails)
const result = await this.query(`
  UPDATE coupon_clicks
  SET ...
  WHERE ...
  ORDER BY clicked_at DESC
  LIMIT 1
  RETURNING id
`, params);
```

**After (Fixed):**
```javascript
// Step 1: SELECT the matching click
const selectResult = await this.query(`
  SELECT id
  FROM coupon_clicks
  WHERE ...
  ORDER BY clicked_at DESC
  LIMIT 1
`, selectParams);

// Step 2: UPDATE the found click by ID
const updateResult = await this.query(`
  UPDATE coupon_clicks
  SET ...
  WHERE id = $4
  RETURNING id
`, [couponUsageId, currentTime, transactionId, clickId]);
```

### 2. Retroactive Linking Script

Created `scripts/retroactive-link-purchases.js` to link existing completed purchases to their clicks:

**Results:**
- Total completed purchases: 18
- Successfully linked: 6
- No matching click found: 12 (users who didn't apply coupon through the system or clicks older than records)

### 3. Verification

After the fix:
- Coupon 66: 7 clicks, 4 purchases, **57.14% conversion rate**, ৳12,000 revenue
- Overall: 6 clicks now correctly marked as `purchase_completed = TRUE`
- All linked clicks have correct `transaction_id` and `coupon_usage_id`

## Files Modified

1. **service/managerial/coupon.js** (line 1487-1610)
   - Fixed `linkClickToPurchase` function
   - Backup created: `service/managerial/coupon.js.backup`

## Scripts Created

1. **scripts/debug-coupon-clicks.js** - Debug script to analyze the issue
2. **scripts/check-purchase-linking.js** - Verification script
3. **scripts/test-link-function.js** - Test the linkClickToPurchase function
4. **scripts/retroactive-link-purchases.js** - Link existing purchases to clicks
5. **scripts/fix-linkClickToPurchase.js** - Automated fix script

## Testing

### Before Fix:
```bash
curl -X GET "http://localhost:4000/admin/coupon/66/click-stats"
# Result: total_clicks: 7, purchases_completed: 0, conversion_rate: 0
```

### After Fix:
```bash
curl -X GET "http://localhost:4000/admin/coupon/66/click-stats"
# Result: total_clicks: 7, purchases_completed: 4, conversion_rate: 57.14, total_revenue: 12000
```

## Prevention

To prevent similar issues in the future:

1. **Add integration tests** for the `linkClickToPurchase` function
2. **Add database query logging** in development to catch SQL errors early
3. **Monitor click-to-purchase linking** with alerts if linking rate drops below threshold
4. **Add SQL linting** to catch unsupported syntax before deployment

## Related Issues

- Time window limitation: The function only links clicks within 7 days of purchase
- Consider extending or making this configurable for edge cases

## Recommendations

1. **Run the retroactive linking script** on production to fix historical data
2. **Audit other SQL queries** in the codebase for similar patterns
3. **Add monitoring** for purchase linking success rate

## API Endpoints Affected

All admin coupon click statistics endpoints now return correct data:
- `GET /admin/coupon/:id/click-stats`
- `GET /admin/coupon/:id/clicks`
- `GET /admin/coupon/coupon-clicks`

## Conclusion

The bug has been fixed and verified. The coupon click tracking system now correctly links clicks to completed purchases, providing accurate conversion rates and revenue tracking for business analytics.
