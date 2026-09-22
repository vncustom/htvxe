import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // PGlite (Postgres biên dịch sang WASM) khởi tạo + chạy migration cho mỗi file
    // test tích hợp — chậm hơn unit test thuần nên nới timeout mặc định.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
