import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { TEST_USERS } from "@/constants/users";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
    const results = [];

    for (const user of TEST_USERS) {
      // Try to create the auth user
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: user.email,
        password: "password123",
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role,
        },
      });

      if (authError) {
        // If user already exists, we try to insert/update the profile manually just in case
        if (authError.message.includes("already registered") || authError.status === 422) {
          // Find user by email to get their ID
          const { data: userList } = await admin.auth.admin.listUsers();
          const existingUser = userList?.users.find((u) => u.email === user.email);
          
          if (existingUser) {
            const { error: profileError } = await admin.from("profiles").upsert({
              id: existingUser.id,
              email: user.email,
              name: user.name,
              role: user.role,
            });
            results.push({ email: user.email, status: "already_exists_profile_upserted", error: profileError?.message });
          } else {
            results.push({ email: user.email, status: "already_exists_but_not_found" });
          }
        } else {
          results.push({ email: user.email, status: "error", error: authError.message });
        }
      } else if (authData?.user) {
        results.push({ email: user.email, status: "created", id: authData.user.id });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
