import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { users, vehicles } from "../db/schema";
import { pageCtx } from "../lib/page";
import { isAdmin, ROLE_LABEL } from "../lib/rbac";
import { hashPassword } from "../lib/password";
import { Layout, Alert } from "../lib/ui";

export const admin = new Hono<Env>();

const str = (v: unknown) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};

const ROLE_OPTIONS = Object.keys(ROLE_LABEL);

/* ================= User ================= */

function UserForm(props: {
  mode: "moi" | "sua";
  u?: typeof users.$inferSelect;
  err?: string;
}) {
  const u = props.u;
  return (
    <div class="card">
      <Alert msg={props.err} />
      <form method="post">
        <div class="row">
          <div>
            <label>Username *</label>
            <input name="username" value={u?.username} required disabled={props.mode === "sua"} />
          </div>
          <div>
            <label>Họ tên *</label>
            <input name="fullName" value={u?.fullName} required />
          </div>
        </div>
        <div class="row">
          <div>
            <label>Vai trò *</label>
            <select name="role" required>
              {ROLE_OPTIONS.map((r) => (
                <option value={r} selected={u?.role === r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Chức danh</label>
            <input name="jobTitle" value={u?.jobTitle ?? ""} />
          </div>
        </div>
        <div class="row">
          <div>
            <label>Ban</label>
            <input name="dsBan" value={u?.dsBan ?? ""} />
          </div>
          <div>
            <label>Phòng</label>
            <input name="dsPhong" value={u?.dsPhong ?? ""} />
          </div>
          <div>
            <label>Tổ</label>
            <input name="dsTo" value={u?.dsTo ?? ""} />
          </div>
        </div>
        <div class="row">
          <div>
            <label>Email</label>
            <input name="email" type="email" value={u?.email ?? ""} />
          </div>
          <div>
            <label>Điện thoại</label>
            <input name="phone" value={u?.phone ?? ""} />
          </div>
        </div>
        <label style="font-weight:400;margin-top:12px">
          <input type="checkbox" name="isDriver" checked={u?.isDriver} style="width:auto;margin-right:6px" />
          Là lái xe
        </label>
        {props.mode === "sua" ? (
          <label style="font-weight:400">
            <input type="checkbox" name="isActive" checked={u?.isActive ?? true} style="width:auto;margin-right:6px" />
            Đang hoạt động
          </label>
        ) : null}
        <div style="margin-top:16px;display:flex;gap:10px">
          <button>Lưu</button>
          <a class="btn sec" href="/quan-tri">Hủy</a>
        </div>
      </form>
      {props.mode === "sua" ? (
        <form method="post" action={`/quan-tri/user/${u!.username}/reset-mk`} style="margin-top:14px" onsubmit="return confirm('Đặt lại mật khẩu về 123456?')">
          <button class="sec">Đặt lại mật khẩu về 123456</button>
        </form>
      ) : null}
    </div>
  );
}

admin.get("/quan-tri/user/moi", async (c) => {
  const { s, badges, openTrips } = await pageCtx(c);
  if (!isAdmin(s)) return c.text("Chỉ quản trị.", 403);
  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/quan-tri" title="Thêm user">
      <h2>Thêm user</h2>
      <UserForm mode="moi" />
    </Layout>,
  );
});

admin.post("/quan-tri/user/moi", async (c) => {
  const s = (await pageCtx(c)).s;
  if (!isAdmin(s)) return c.text("Chỉ quản trị.", 403);
  const db = c.get("db");
  const f = await c.req.formData();
  const username = String(f.get("username") ?? "").trim();
  const fullName = String(f.get("fullName") ?? "").trim();
  if (!username || !fullName) return c.text("Thiếu username hoặc họ tên.", 400);

  const [existing] = await db.select({ username: users.username }).from(users).where(eq(users.username, username)).limit(1);
  if (existing) return c.text("Username đã tồn tại.", 409);

  await db.insert(users).values({
    username,
    fullName,
    role: String(f.get("role") ?? "nhan_vien"),
    dsBan: str(f.get("dsBan")),
    dsPhong: str(f.get("dsPhong")),
    dsTo: str(f.get("dsTo")),
    jobTitle: str(f.get("jobTitle")),
    email: str(f.get("email")),
    phone: str(f.get("phone")),
    isDriver: f.get("isDriver") === "on",
    passwordHash: await hashPassword("123456"),
    updatedBy: s.username,
  });
  return c.redirect("/quan-tri");
});

admin.get("/quan-tri/user/:username", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  if (!isAdmin(s)) return c.text("Chỉ quản trị.", 403);
  const [u] = await db.select().from(users).where(eq(users.username, c.req.param("username"))).limit(1);
  if (!u) return c.notFound();
  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/quan-tri" title={`Sửa ${u.username}`}>
      <h2>Sửa user — {u.username}</h2>
      <UserForm mode="sua" u={u} />
    </Layout>,
  );
});

admin.post("/quan-tri/user/:username", async (c) => {
  const s = (await pageCtx(c)).s;
  if (!isAdmin(s)) return c.text("Chỉ quản trị.", 403);
  const db = c.get("db");
  const username = c.req.param("username");
  const f = await c.req.formData();
  await db
    .update(users)
    .set({
      fullName: String(f.get("fullName") ?? "").trim() || undefined,
      role: String(f.get("role") ?? "nhan_vien"),
      dsBan: str(f.get("dsBan")),
      dsPhong: str(f.get("dsPhong")),
      dsTo: str(f.get("dsTo")),
      jobTitle: str(f.get("jobTitle")),
      email: str(f.get("email")),
      phone: str(f.get("phone")),
      isDriver: f.get("isDriver") === "on",
      isActive: f.get("isActive") === "on",
      updatedAt: new Date(),
      updatedBy: s.username,
    })
    .where(eq(users.username, username));
  return c.redirect("/quan-tri");
});

admin.post("/quan-tri/user/:username/reset-mk", async (c) => {
  const s = (await pageCtx(c)).s;
  if (!isAdmin(s)) return c.text("Chỉ quản trị.", 403);
  const db = c.get("db");
  const username = c.req.param("username");
  await db.update(users).set({ passwordHash: await hashPassword("123456"), updatedAt: new Date(), updatedBy: s.username }).where(eq(users.username, username));
  return c.redirect(`/quan-tri/user/${username}`);
});

/* ================= Xe ================= */

function VehicleForm(props: { mode: "moi" | "sua"; v?: typeof vehicles.$inferSelect; err?: string }) {
  const v = props.v;
  return (
    <div class="card">
      <Alert msg={props.err} />
      <form method="post">
        <div class="row">
          <div><label>Tên xe *</label><input name="name" value={v?.name} required /></div>
          <div><label>Biển số *</label><input name="plateNo" value={v?.plateNo} required /></div>
          <div><label>Số chỗ *</label><input name="seats" type="number" min="1" value={v?.seats} required /></div>
        </div>
        <label>Ghi chú</label>
        <input name="note" value={v?.note ?? ""} />
        {props.mode === "sua" ? (
          <label style="font-weight:400;margin-top:12px">
            <input type="checkbox" name="isActive" checked={v?.isActive ?? true} style="width:auto;margin-right:6px" />
            Đang hoạt động
          </label>
        ) : null}
        <div style="margin-top:16px;display:flex;gap:10px">
          <button>Lưu</button>
          <a class="btn sec" href="/quan-tri">Hủy</a>
        </div>
      </form>
      {props.mode === "sua" ? <p class="muted" style="margin-top:10px">Sửa số km xe ở trang <a href="/cong-to-met">Công-tơ-mét</a>.</p> : null}
    </div>
  );
}

admin.get("/quan-tri/xe/moi", async (c) => {
  const { s, badges, openTrips } = await pageCtx(c);
  if (!isAdmin(s)) return c.text("Chỉ quản trị.", 403);
  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/quan-tri" title="Thêm xe">
      <h2>Thêm xe</h2>
      <VehicleForm mode="moi" />
    </Layout>,
  );
});

admin.post("/quan-tri/xe/moi", async (c) => {
  const s = (await pageCtx(c)).s;
  if (!isAdmin(s)) return c.text("Chỉ quản trị.", 403);
  const db = c.get("db");
  const f = await c.req.formData();
  const name = String(f.get("name") ?? "").trim();
  const plateNo = String(f.get("plateNo") ?? "").trim();
  const seats = Number(f.get("seats") ?? 0);
  if (!name || !plateNo || !seats) return c.text("Thiếu tên, biển số hoặc số chỗ.", 400);
  await db.insert(vehicles).values({ name, plateNo, seats, note: str(f.get("note")), updatedBy: s.username });
  return c.redirect("/quan-tri");
});

admin.get("/quan-tri/xe/:id", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  if (!isAdmin(s)) return c.text("Chỉ quản trị.", 403);
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, c.req.param("id"))).limit(1);
  if (!v) return c.notFound();
  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/quan-tri" title={`Sửa ${v.name}`}>
      <h2>Sửa xe — {v.name}</h2>
      <VehicleForm mode="sua" v={v} />
    </Layout>,
  );
});

admin.post("/quan-tri/xe/:id", async (c) => {
  const s = (await pageCtx(c)).s;
  if (!isAdmin(s)) return c.text("Chỉ quản trị.", 403);
  const db = c.get("db");
  const id = c.req.param("id");
  const f = await c.req.formData();
  await db
    .update(vehicles)
    .set({
      name: String(f.get("name") ?? "").trim() || undefined,
      plateNo: String(f.get("plateNo") ?? "").trim() || undefined,
      seats: Number(f.get("seats") ?? 0) || undefined,
      note: str(f.get("note")),
      isActive: f.get("isActive") === "on",
      updatedAt: new Date(),
      updatedBy: s.username,
    })
    .where(eq(vehicles.id, id));
  return c.redirect("/quan-tri");
});
