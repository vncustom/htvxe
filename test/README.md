# Test

> Tài liệu này dành cho người viết code (giải thích công cụ, cấu trúc thư mục). Nếu bạn
> không rành kỹ thuật và chỉ muốn biết cách kiểm tra app còn chạy đúng không, đọc
> [`docs/kiem-tra-app.md`](../docs/kiem-tra-app.md) thay vì file này.

## Công cụ

| | Chọn gì | Vì sao |
|---|---|---|
| Test runner | **Vitest** | Chạy trên Node thuần (không cần `@cloudflare/vitest-pool-workers`/`workerd`) — code trong `src/` (Hono + Drizzle + WebCrypto) không đụng API riêng của Workers ngoài `c.env`/`c.executionCtx`, cả hai đều dễ giả lập bằng object thường. Nhanh, cấu hình tối thiểu (`vitest.config.ts`), API giống Jest. |
| DB test tích hợp | **PGlite** (`@electric-sql/pglite`) | Postgres thật biên dịch sang WASM, chạy trong bộ nhớ — không cần Docker/Testcontainers, không cần mạng, không cần `DATABASE_URL`. Áp thẳng các file SQL trong `drizzle/` (cùng DDL/index dùng để tạo bảng trên Supabase) nên test chạy trên schema/constraint/index **y hệt production**, không phải bản rút gọn tay. Drizzle có driver `drizzle-orm/pglite` cùng interface query builder với `drizzle-orm/postgres-js` dùng ở production (`src/db/client.ts`), nên code trong `lib/`/`routes/` chạy y nguyên, không cần nhánh test riêng. |
| HTTP tích hợp | `app.request(path, init, env, executionCtx)` của Hono | Gọi thẳng route thật (`createApp()` trong `src/index.tsx`) qua `fetch()`, không cần server thật đang chạy — exercise đúng middleware, rbac, Drizzle query, không phải mock tầng route. |

**Vì sao không Testcontainers?** Đúng chuẩn hơn cho CI có Docker, nhưng máy dev ở đây
(Windows, không Docker) không chạy được — PGlite cho cùng mức độ chính xác SQL mà không
cần hạ tầng ngoài.

## Cấu trúc

```
test/
  helpers/
    db.ts      createTestDb() — PGlite + áp drizzle/*.sql; truncateAll() dọn giữa các test
    app.ts     buildTestApp(db) — app Hono thật, DB middleware trỏ vào PGlite thay vì Postgres
               sessionCookie(session) — ký cookie JWT giống lib/session.ts, không cần đăng nhập qua form
               testEnv()/testExecutionCtx() — giả Bindings + ExecutionContext tối thiểu
    seed.ts    seedBasicFixture(db) — bộ user/xe tối thiểu để chạy hết vòng đời 1 đơn
  unit/        Hàm thuần trong src/lib/* (rbac, status, tz, vehicleGroups, odometer, password) —
               không đụng DB, chạy trong mili giây.
  integration/
    queries.test.ts       lib/queries.ts chạy trực tiếp trên PGlite (loadBooking — đặc biệt là
                           JOIN gộp mới thay 9 round-trip cũ, findBusyInWindow, genBookingCode, getBadges)
    booking-flow.test.ts  vòng đời 1 đơn qua HTTP thật: tạo → Ban duyệt → Đội xe điều xe →
                           lái xe bắt đầu/kết thúc, cộng vài ca rbac chặn (403) và chuyển hướng
                           đăng nhập (302 → /login)
```

## Chạy

```bash
npm test               # toàn bộ
npm run test:unit
npm run test:integration
npm run test:watch     # chế độ theo dõi khi code
npm run typecheck:test # tsc --noEmit riêng cho test/ (tsconfig.test.json — xem ghi chú bên dưới)
```

## Vì sao có `tsconfig.test.json` riêng

`tsconfig.json` gốc chỉ `types: ["@cloudflare/workers-types"]` cho `src/` (đúng môi
trường Workers khi build production). Test cần thêm `@types/node` (`node:fs`,
`import.meta.url`...) để dựng PGlite/đọc file migration — gộp thẳng vào tsconfig gốc có
rủi ro xung đột kiểu global giữa 2 bộ types. `tsconfig.test.json` kế thừa tsconfig gốc,
chỉ thêm `"node"` vào `types` và mở rộng `include` sang `test/` — không đụng
`npm run typecheck` (build production) vốn vẫn chỉ soi `src/`.

## Viết test mới

- Test thuần logic (không DB) → `test/unit/`, import thẳng từ `src/lib/*`.
- Test cần DB nhưng không cần đi qua route/rbac → `test/integration/`, gọi thẳng hàm
  trong `lib/queries.ts` (hoặc `db.insert/select` trực tiếp) trên `createTestDb()`.
- Test cả 1 luồng nghiệp vụ qua HTTP (rbac + chuyển trạng thái + notify) →
  `test/integration/`, dùng `buildTestApp(db)` + `sessionCookie(...)` như
  `booking-flow.test.ts`.
