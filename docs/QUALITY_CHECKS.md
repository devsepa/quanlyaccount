# Kiểm tra chất lượng — 16/10/2026

Các thay đổi dành cho web quản lý acc; không thay TOOL_MAKE.js.

## Chạy lại kiểm tra

`npm test`

17 kiểm tra cho xung đột, xác nhận nhật ký, mã phiên bản và Telegram. Ngoài ra đã chạy 35 kiểm tra hồi quy hiện có trong bộ kiểm thử tạm của phiên làm việc.

## Đã kiểm tra bằng dữ liệu giả

- Chuyển acc vừa mở BAN vào Rank hoặc Chung Sức, giữ ID/lịch sử, tìm lại và nạp lại dữ liệu.
- Phân biệt acc dùng được, đang BAN, chờ kiểm tra sau BAN và kho cần lọc; giữ kho Chung Sức riêng.
- Mất mạng, Firebase từ chối, mất phản hồi: không ghi nhật ký thao tác thành công trước xác nhận.
- Thay đổi tiếp trong lúc đang lưu: giữ đợt mới chờ xác nhận; không ghi nhận kho trung gian chưa lưu.
- Hai Admin sửa trường khác nhau: gộp dữ liệu. Cùng trường có giá trị khác nhau: chặn ghi đè.
- Acc bị xóa hoặc sửa từ thiết bị khác: không tự khôi phục/xóa đè bằng bản cũ.
- Telegram: khóa gửi chung, gửi một lần, chờ khi bị giới hạn, không tự gửi lại khi mất phản hồi.
- Các tài nguyên CSS/JS nội bộ dùng cùng mã phiên bản `20261016-quality-1`.

Kiểm thử dùng mô phỏng DOM/Firebase/Telegram, không ghi dữ liệu thật hoặc gửi tin thật.

## Cần kiểm tra trên điện thoại thật trước khi phát hành

Chưa chạy trình duyệt Android/iPhone thật trong môi trường này. Các kiểm tra logic không thay thế kiểm tra giao diện.

Thực hiện trên Chrome Android và Safari iPhone, màn hình dọc/ngang, bàn phím mở/đóng:

1. Vào danh sách BAN: tên dài xuống dòng; nút sửa ngày dễ bấm; không tràn ngang.
2. Đổi ngày BAN về hôm nay, vào kho chờ kiểm tra, chuyển một acc thử vào Rank và một acc vào Chung Sức. Tìm toàn bộ kho và tải lại: mỗi acc chỉ còn một bản ghi đúng kho.
3. Tắt mạng rồi chuyển acc: giao diện báo còn thay đổi trên máy, nhật ký chưa ghi thành công. Bật mạng, thử đồng bộ: chỉ có một nhật ký sau xác nhận.
4. Hai thiết bị cùng sửa một trường: thiết bị sau báo xung đột. Chọn Dùng bản cloud, xác nhận; bản trên máy phải được sao lưu trước khi thay.
5. Mở nút Telegram trong công cụ Admin: kiểm tra trạng thái chờ/đã gửi/lỗi/chưa xác minh. Thử lại lỗi xác định, tôn trọng thời gian chờ. Với chưa xác minh, kiểm tra kênh trước, không gửi lại tự động.
6. Tải lại trang trên máy từng mở bản cũ: kiểm tra CSS và JS có cùng tham số phiên bản; giao diện BAN vẫn là các thẻ có khoảng cách.

Lịch sử Telegram hiển thị 100 mục gần nhất trên thiết bị, gồm chuyển kho và bản tin BAN từ khi cập nhật. Thông báo thêm acc, cảnh báo riêng tư và tin kiểm tra cũng có trạng thái. Nút thử lại các tin này chỉ khả dụng trong phiên hiện tại để không lưu nội dung/mật khẩu vào lịch sử gửi.

## Khi cập nhật lần sau

Đổi đồng thời mã `?v=` của các CSS và JS nội bộ trong index.html. Giữ một mã cho toàn bộ tài nguyên trong cùng lần phát hành.


## Minimal Dark Dashboard — 16/10/2026

- Minimal Dark theme: styles/dashboard.css loads last. dashboard-ui.js delegates existing controls and mirrors existing counters; no additional API or storage is introduced.
- Desktop checked with Chrome headless at 1600×1100; mobile emulation at 390×844 and 360×800. No horizontal overflow or JavaScript errors in the mocked preview; table/card switching and sidebar open/close verified.
- Preview uses synthetic account records and intercepts Firebase/Telegram requests. It does not modify live records or send real messages.
- Run `npm test` for regression checks.
- Physical Android Chrome and iPhone Safari still require a final device check. Chrome viewport emulation does not establish Safari compatibility.

- Mock browser interaction checks passed: add form opens, warehouse selection changes to Chung Sức, username search returns one matching card, guest hides Admin/filter/unban controls. Real clipboard access and real cloud mutations were not exercised in this UI preview.


## Dashboard consolidation — 16/10/2026

- Removed the duplicated overview cards; original warehouse cards retain counts and selection handlers.
- Sidebar now contains Accounts, Statistics and Settings. Statistics/Settings reuse the original DOM buttons and handlers. The original settings popup is attached to body to avoid sidebar clipping.
- Moved the original cloud status/retry/conflict controls to the sidebar footer; active/BAN counters appear once beside the account list.
- Browser mock checks: exactly three sidebar buttons, no duplicated overview, one settings button, one cloud-status control; settings popup fits mobile viewport; cloud/statistics panels open, sidebar closes when a panel opens.
- Desktop 1600px and mobile 390px/360px retain correct table/card mode with no horizontal overflow or JavaScript errors. Add form, warehouse switch, search, Rank/BAN/history and guest visibility checks passed.


## Phone layout — 16/10/2026

- Dedicated rules at 600px and below: compact header, two-column warehouse tiles, grouped Admin actions, horizontally scrollable Rank/history filters, and account-first mobile cards.
- Mobile account cards show credentials and editing/copy controls before the usage/creation metadata. Transfer, copy, delete and unban destination actions remain available.
- Chrome device emulation at 390px/360px: no page overflow or JavaScript errors; account cards visible, desktop tables hidden. Sidebar/settings/cloud/statistics, add-form opening, warehouse selection, search, Rank/BAN/history and guest visibility passed against mock data.
- Desktop 1600px retains the table layout. Physical iPhone Safari / Android devices still need a device check; no live clipboard/cloud writes were used for this UI verification.


## Analytics presentation — 16/10/2026

- New scoped styles/analytics.css redesigns the report modal: filter panel, four KPI cards, sticky report tabs, grouped chart/table sections and full-screen phone layout.
- Report calculations, account data and API/storage behavior are unchanged. Date-range and warehouse filters retain their original handlers.
- Chrome mock checks at 1600px, 390px and 360px: modal fits viewport and report body has no horizontal overflow or JavaScript errors. Wide mobile tables scroll inside their own containers.
- Confirmed 30 chart columns for the 30-day filter; selecting a column opens details. Chung Sức filter returns the expected 2 mock accounts; all four report tabs open correctly.
- Existing regression suite: 17/17 passed. Physical Safari/iPhone/Android checks and real service writes are not part of this UI preview.


## Layout balance and motion — 16/10/2026

- Same brand DOM element moves to the top of the sidebar on desktop and returns to the header below 1101px. No duplicate brand/typewriter IDs; existing typing animation remains attached.
- Desktop header shows page context; warehouse heading aligns with the content edge. Brand dimensions reserve space to avoid layout jumps while text types/deletes.
- Added brief staggered card entrance, fine-pointer hover lift, button press feedback and sidebar/modal fade/slide. Reduced-motion styles suppress these effects; typewriter initializes to static devsepa when reduced motion is selected.
- Rank column reserves more room for BK/KC/TA/CT/DCT abbreviations. Narrow desktop tables scroll within their container to retain readable controls.
- Mock Chrome checks: one brand at desktop/mobile; sidebar width remains within bounds; 1600px, 390px and 360px have no page overflow or JS errors. Menu/settings/cloud/statistics, forms, warehouse/search/Rank/BAN/history and guest visibility passed. Regression suite: 17/17 passed.


## False sync conflict and repeated dialogs — 16/10/2026

- Reproduced an unban-to-Rank move failing when Firebase omitted unbanCleared/unbanReviewedAt but the local normalized baseline contained false/0. Numeric trust values vs UI strings could cause the same false conflict.
- Merge comparisons now use the same default/string/number/boolean semantics as account normalization. Actual conflicting values still throw ACCOUNT_CONFLICT without overwriting cloud data.
- Telegram background outbox waits for synchronization with silent:true. A known conflict is not automatically retried at the same local revision; foreground conflict dialogs appear once per unchanged revision and use the correct title.
- Success or explicit use-cloud recovery clears the conflict state. Local data and pending audits are retained on failure.
- 27/27 regression tests passed, including 10 new tests covering unban moves, normalized types/defaults, actual conflicts, lost responses and silent background behavior. No live Firebase data was modified during verification.


## Reference desktop and phone layout — 16/10/2026

- Dedicated styles/layout-refinement.css composes the approved layout without changing cloud/account storage logic.
- Desktop keeps warehouse cards in one row when all four Admin warehouses are present. Phones use two columns, retain the logo/typewriter/bell, move the original role button into the drawer and retain the greeting role badge.
- The same original navigation DOM moves into a three-item phone bottom bar, then back to the sidebar above 600px. No duplicate Statistics/Settings IDs or action handlers.
- Original active/BAN counters sit beside the list heading. Original collapse action joins desktop search controls. The new filter button actually toggles the BAN/history section; Rank choices remain available.
- Keyboard focus cycling excludes hidden controls. Notifications retain existing visualViewport positioning instead of a fixed mobile top offset.
- Mock Chrome checks: 1600px/1200px four warehouses share one row; 390px/360px form two rows; 768px also checked. No page overflow or JS errors. Exactly one navigation tree, three phone bottom actions, one Statistics and one Settings control. Filter hide/show, add form, warehouses, search, BAN/Rank/history, settings/cloud/statistics and guest visibility passed.
- Analytics checked at desktop/390px/360px: modal fits, no body overflow, 30-day bars/details, warehouse scope and all report tabs work. 31 regression tests passed. Tests use synthetic data, with no real cloud writes or Telegram sends. Physical iPhone/Safari remains unverified.

## Hour-based BAN schedule — 17/10/2026

- Added optional 00–23 opening-hour selection to account creation, filter-to-Rank transfer and BAN schedule editing. Exact timestamps use Asia/Ho_Chi_Minh (UTC+7); existing date-only accounts retain their previous behavior.
- ban-schedule.js owns validation, timestamp normalization, countdowns and reminder windows. Stored timestamps preserve the intended year across New Year. Local/cloud normalization and account conflict comparisons include the new schedule and reminder fields.
- ban-schedule-ui.js updates countdowns each second, emits stable 6-hour/1-hour reminder notifications and marks each target/window once. At the deadline the existing warehouse classification places the same account in Acc vừa mở BAN for Admin review; no account is copied or deleted.
- Telegram daily summaries support the 1-hour window and include the opening hour. Browser reminders and Telegram scans require an open, active Admin session; delivery with all browsers closed requires a server-side scheduler.
- 41 regression tests passed: Vietnam time, midnight, invalid dates/hours, exact expiry, New Year, reminder deduplication, schedule edits, filter transfers, cloud merge conflicts and Telegram classification. Mock Chrome checks cover 1600px, 390px and 360px with no page overflow or JavaScript errors. No live Firebase writes or real Telegram sends were performed.

## Six management improvements — 17/10/2026

- Added opt-in bulk selection with visible-row selection, BAN date/hour edits, warehouse moves and selected-account JSON export. Unsafe pending-review moves and stale selections are rejected. Group actions preserve IDs/history and snapshot before changes.
- Main import now checks the filter warehouse and offers skip/password-update for duplicates in the main warehouse. Password update preserves ID, warehouse, BAN schedule and usage history. Filter transfer has an Auth-backed atomic server path with optional duplicate password update and a 7-day source archive.
- Added audit date range controls, schedule-field labels, accurate warehouse names and lost-response reconciliation for immutable audit entries. Server audit derives account changes and omits password values.
- Added scheduled BAN outbox and expiry review routing, daily server backup retention, atomic preview/revision-guarded restore and pre-restore recovery snapshots. Scheduler and guest-copy transactions only read app_data; multi-warehouse transfer/restore transactions read the database root for atomicity.
- Added Firebase REST email/password Admin sign-in, anonymous guest sessions, token refresh, verified server endpoints, custom claims plus revocable admin_access registry, and restrictive Realtime Database Rules. Legacy PIN/token fields are excluded from secure writes. Migration and grant/revoke scripts are explicit operations.
- app-config.js intentionally leaves secureMode/serverScheduler false until real Firebase configuration, CLI authorization, Secrets and migration are completed together. No real Firebase writes, Telegram messages or deployment were performed. Firebase CLI reports no authorized accounts on this machine.
- 58 logic/auth/regression tests passed using Node.js 22; 7 Database Emulator security tests passed using a demo project and Java 21. Tests cover guest write denial, blocked-device self-unblocking/deletion denial, revoked Admin claims, private backups and immutable audit. Backend exports compile/load with installed locked SDKs.
- Mock Chrome at 1600px, 390px and 360px: no page overflow or JS errors; bulk selection/schedule edit, duplicate update, audit dates and guest hiding passed. Physical iPhone/Safari and live IAM/Scheduler/Telegram remain unverified. See docs/DEPLOYMENT.md for deployment order and the remaining live-service checks.

## Folder cleanup — 17/10/2026

- Moved 14 browser scripts into assets/js, root documentation into docs and the remaining management test into tests. Updated HTML script URLs, CommonJS imports, npm test and documentation paths.
- Previous test directories were already absent at the start of this cleanup and were not restored. npm test now runs the 5 existing management tests; all passed. Historical totals above describe earlier checkouts.
- Verified all 23 local HTML resources exist. Removed the stale site.webmanifest link because the referenced file was already missing.
- Mock Chrome at 1600px, 390px and 360px: no JS errors or horizontal overflow; bulk scheduling, duplicate update, audit date controls and guest visibility passed after the moves. Firebase deployment paths remain at the repository root.

## Unban review workflow — 17/10/2026

- Root cause: the review warehouse reused Rank grouping, filtering and collapsed-state visibility. A Rank edit could move an account under a hidden group without actually deleting it.
- The review warehouse now renders a flat, always-expanded list, ignores Rank/history filters, and retains review membership when editing Rank/trust. Editing metadata preserves row order, ID and usage history. Date fields are read-only in this warehouse; copied review accounts retain the just-unbanned status until explicit transfer.
- Confirmed transfer first saves pending metadata, then performs one app_data CAS transaction that updates the account and persists its notification. Failed/cancelled moves do not remove the local review account or announce success. Lost responses are verified from the durable transfer notice. Review changes in another session are rejected instead of overwriting them.
- Web and Telegram announcements follow confirmed persistence. Messages carry the selected destination, current Rank/trust and no password. Legacy browser delivery keeps stable receipt IDs; server-scheduler mode stores the transfer in the same transaction's server outbox, with a transfer-specific server message.
- npm test: 12/12 passed, including explicit move validation, metadata/history preservation, concurrent retries, rejected writes, lost responses and notification content. Mock Chrome at 1600px, 390px and 360px: no JS errors/overflow; metadata edits keep both accounts in the same order; cancel/rejected move produces zero notices/sends; successful move produces one web notice and one mocked Telegram send. No real cloud writes or Telegram messages were used for validation.

## Automatic sync recovery — 17/10/2026

- Pending writes retry automatically with bounded backoff (2, 4, 8, 16, 32, then 60 seconds), pause while hidden/offline and resume on reconnect/focus/visibility or refreshed authentication. Restored pending edits also resume after startup; writes wait for the CAS helper to load before proceeding.
- Three-way merge still combines compatible field edits. Concurrent usage updates preserve a coherent latest usage record and the highest observed count (not an additive event log). A stale review pin cannot reopen a remotely reviewed/moved account.
- In recover mode, a genuinely conflicted account keeps its cloud version. The full local/baseline/cloud record is durably saved in lq_sync_recovery before writing any recovered merge; other accounts can save normally. Deleted cloud accounts are not resurrected, changed remote records are not silently deleted, and conflicting usernames are not overwritten.
- Admin can open/download recovery drafts via the existing sync status area; passwords are omitted from the on-screen list. Recovery drafts remain on this browser/device and are not uploaded. Identical retries are deduplicated. Capacity is bounded at 100 records/2 MB; storage/permission failures preserve pending edits and stop background write retries until intervention/reconnect, rather than discarding drafts.
- Expected synchronization failures no longer open repeated modal dialogs. Nonblocking status text communicates pending/recovered states. Rejected edits are not recorded as successfully saved audits. Edits made during an in-flight request carry only their own delta over committed cloud fields.
- npm test: 22/22 passed. Mock Chrome fault injection confirmed transient 503 retry success, offline/reconnect, conflicting-account recovery plus other-account save, hidden password content in recovery UI, 403 blocking without a write loop, recovery after restored permission, lost-response idempotence, quota protection with no cloud write, and edits entered while a previous save is in flight. No real backend writes occurred.
