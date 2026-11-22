import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ORG_ROLES = ["admin", "accountant", "researcher", "warehouse", "distributor", "auditor", "volunteer"];
const PLANS = ["trial", "basic", "pro"];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const emailFor = (phone: string) => `${phone}@alrahma.local`;
const cleanPhone = (v: unknown) => String(v ?? "").replace(/\s/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: who } = await service.auth.getUser(token);
  if (!who?.user) return json({ error: "لازم تسجل دخول" }, 401);
  const { data: me } = await service.from("ch_profiles").select("role, active, org_id").eq("id", who.user.id).maybeSingle();
  if (!me || !me.active) return json({ error: "غير مصرح" }, 403);
  const isOwner = me.role === "owner";
  if (!isOwner) {
    if (me.role !== "admin") return json({ error: "هذا الإجراء للمدير فقط" }, 403);
    const { data: org } = await service.from("ch_orgs").select("status, subscription_ends").eq("id", me.org_id).single();
    const expired = org?.subscription_ends && new Date(org.subscription_ends) < new Date(new Date().toDateString());
    if (!org || org.status !== "active" || expired) return json({ error: "اشتراك المؤسسة موقوف" }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "طلب غير صالح" }, 400); }
  const action = String(body.action ?? "");

  const createUser = async (org_id: string, full_name: string, phone: string, role: string, password: string) => {
    if (full_name.length < 3) return "اكتب الاسم الكامل";
    if (!/^07\d{9}$/.test(phone)) return "رقم الهاتف لازم 11 رقم ويبدأ بـ 07";
    if (!ORG_ROLES.includes(role)) return "دور غير صالح";
    if (password.length < 8) return "كلمة السر 8 أحرف على الأقل";
    const { data: created, error } = await service.auth.admin.createUser({ email: emailFor(phone), password, email_confirm: true, user_metadata: { full_name } });
    if (error || !created.user) return /already/i.test(error?.message ?? "") ? "هذا الرقم مسجل من قبل" : "تعذر إنشاء الحساب";
    const { error: pErr } = await service.from("ch_profiles").insert({ id: created.user.id, full_name, phone, role, org_id });
    if (pErr) { await service.auth.admin.deleteUser(created.user.id); return "تعذر حفظ بيانات العضو"; }
    return null;
  };

  const removeFolder = async (bucket: string, prefix: string) => {
    const stack = [prefix];
    while (stack.length) {
      const dir = stack.pop()!;
      const { data } = await service.storage.from(bucket).list(dir, { limit: 1000 });
      if (!data?.length) continue;
      const files = data.filter((x) => x.id).map((x) => `${dir}/${x.name}`);
      data.filter((x) => !x.id).forEach((x) => stack.push(`${dir}/${x.name}`));
      if (files.length) await service.storage.from(bucket).remove(files);
    }
  };

  // ---------- platform owner ----------
  if (action === "create_org") {
    if (!isOwner) return json({ error: "لمالك المنصة فقط" }, 403);
    const name = String(body.name ?? "").trim();
    if (name.length < 3) return json({ error: "اكتب اسم المؤسسة" }, 400);
    const plan = PLANS.includes(String(body.plan)) ? String(body.plan) : "trial";
    const months = Math.min(36, Math.max(1, Number(body.months) || 1));
    const ends = new Date(); ends.setMonth(ends.getMonth() + months);
    const { data: org, error } = await service.from("ch_orgs").insert({
      name, tagline: String(body.tagline ?? "").trim() || null, governorate: String(body.governorate ?? "").trim() || null,
      contact_phone: cleanPhone(body.admin_phone) || null, plan, subscription_ends: ends.toISOString().slice(0, 10),
    }).select("id").single();
    if (error || !org) return json({ error: "تعذر إنشاء المؤسسة" }, 400);
    const err = await createUser(org.id, String(body.admin_name ?? "").trim(), cleanPhone(body.admin_phone), "admin", String(body.password ?? ""));
    if (err) { await service.from("ch_orgs").delete().eq("id", org.id); return json({ error: err }, 400); }
    return json({ ok: true, org_id: org.id });
  }
  if (action === "set_org") {
    if (!isOwner) return json({ error: "لمالك المنصة فقط" }, 403);
    const patch: Record<string, unknown> = {};
    if (body.status === "active" || body.status === "suspended") patch.status = body.status;
    if (PLANS.includes(String(body.plan))) patch.plan = body.plan;
    if (typeof body.subscription_ends === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.subscription_ends)) patch.subscription_ends = body.subscription_ends;
    const { error } = await service.from("ch_orgs").update(patch).eq("id", String(body.org_id ?? ""));
    if (error) return json({ error: "تعذر التحديث" }, 400);
    return json({ ok: true });
  }
  if (action === "org_members") {
    if (!isOwner) return json({ error: "لمالك المنصة فقط" }, 403);
    const { data } = await service.from("ch_profiles").select("id, full_name, phone, role, active, created_at").eq("org_id", String(body.org_id ?? "")).order("created_at");
    return json({ ok: true, members: data ?? [] });
  }
  if (action === "delete_org") {
    if (!isOwner) return json({ error: "لمالك المنصة فقط" }, 403);
    const org_id = String(body.org_id ?? "");
    const { data: org } = await service.from("ch_orgs").select("id, name").eq("id", org_id).maybeSingle();
    if (!org) return json({ error: "المؤسسة غير موجودة" }, 404);
    if (String(body.confirm_name ?? "").trim() !== org.name.trim()) return json({ error: "اكتب اسم المؤسسة بالضبط حتى تأكد الحذف" }, 400);
    const { data: people } = await service.from("ch_profiles").select("id").eq("org_id", org_id);
    await removeFolder("ch-invoices", org_id);
    await removeFolder("ch-logos", org_id);
    await removeFolder("ch-ids", org_id);
    const { error } = await service.from("ch_orgs").delete().eq("id", org_id);
    if (error) return json({ error: "تعذر حذف المؤسسة" }, 400);
    for (const p of people ?? []) await service.auth.admin.deleteUser(p.id);
    return json({ ok: true });
  }

  // ---------- organization team ----------
  if (action === "create") {
    const org_id = isOwner ? String(body.org_id ?? "") : me.org_id;
    if (!org_id) return json({ error: "اختار المؤسسة" }, 400);
    const err = await createUser(org_id, String(body.full_name ?? "").trim(), cleanPhone(body.phone), String(body.role ?? ""), String(body.password ?? ""));
    return err ? json({ error: err }, 400) : json({ ok: true });
  }

  const user_id = String(body.user_id ?? "");
  const { data: target } = await service.from("ch_profiles").select("id, org_id, role").eq("id", user_id).maybeSingle();
  if (!target || target.role === "owner" || (!isOwner && target.org_id !== me.org_id)) return json({ error: "العضو غير موجود" }, 404);

  if (action === "set_password") {
    const password = String(body.password ?? "");
    if (password.length < 8) return json({ error: "كلمة السر 8 أحرف على الأقل" }, 400);
    const { error } = await service.auth.admin.updateUserById(user_id, { password });
    return error ? json({ error: "تعذر تغيير كلمة السر" }, 400) : json({ ok: true });
  }
  if (action === "set_active") {
    if (user_id === who.user.id) return json({ error: "ما تكدر توقف حسابك الشخصي" }, 400);
    const active = Boolean(body.active);
    await service.from("ch_profiles").update({ active }).eq("id", user_id);
    await service.auth.admin.updateUserById(user_id, { ban_duration: active ? "none" : "876000h" });
    return json({ ok: true });
  }
  if (action === "set_perms") {
    const ALLOWED = ["families_view", "families_add", "distribute", "campaigns_view", "inventory_view"];
    if (target.role !== "volunteer") return json({ error: "الصلاحيات المخصصة للمتطوعين فقط" }, 400);
    const raw = Array.isArray(body.perms) ? body.perms.map(String) : [];
    if (raw.some((x) => !ALLOWED.includes(x))) return json({ error: "صلاحية غير معروفة" }, 400);
    const { error } = await service.from("ch_profiles").update({ perms: [...new Set(raw)] }).eq("id", user_id);
    return error ? json({ error: "تعذر حفظ الصلاحيات" }, 400) : json({ ok: true });
  }
  if (action === "set_role") {
    const role = String(body.role ?? "");
    if (!ORG_ROLES.includes(role)) return json({ error: "دور غير صالح" }, 400);
    if (user_id === who.user.id && role !== "admin") return json({ error: "ما تكدر تشيل صلاحية المدير من نفسك" }, 400);
    await service.from("ch_profiles").update({ role }).eq("id", user_id);
    return json({ ok: true });
  }
  return json({ error: "إجراء غير معروف" }, 400);
});
