import { CreditsAmount, CreditsTransType } from "./credit";
import { findUserByEmail, findUserByUuid, insertUser, findUserByEmailOrUsername, findUserByUsername } from "@/models/user";

import { User } from "@/types/user";
import { auth } from "@/auth";
import { getIsoTimestr, getOneYearLaterTimestr } from "@/lib/time";
import { getUserUuidByApiKey } from "@/models/apikey";
import { headers } from "next/headers";
import { increaseCredits } from "./credit";
import { users } from "@/db/schema";
import { getUuid } from "@/lib/hash";
import bcrypt from "bcryptjs";

// save user to database, if user not exist, create a new user
export async function saveUser(user: User) {
  try {
    if (!user.email) {
      throw new Error("invalid user email");
    }

    const existUser = await findUserByEmail(user.email);

    if (!existUser) {
      // user not exist, create a new user
      if (!user.uuid) {
        user.uuid = getUuid();
      }

      console.log("user to be inserted:", user);

      const dbUser = await insertUser(user as typeof users.$inferInsert);

      // increase credits for new user, expire in one year
      await increaseCredits({
        user_uuid: user.uuid,
        trans_type: CreditsTransType.NewUser,
        credits: CreditsAmount.NewUserGet,
        expired_at: getOneYearLaterTimestr(),
      });

      user = {
        ...(dbUser as unknown as User),
      };
    } else {
      // user exist, return user info in db
      user = {
        ...(existUser as unknown as User),
      };
    }

    return user;
  } catch (e) {
    console.log("save user failed: ", e);
    throw e;
  }
}

export async function getUserUuid() {
  let user_uuid = "";

  const token = await getBearerToken();

  if (token) {
    // api key
    if (token.startsWith("sk-")) {
      const user_uuid = await getUserUuidByApiKey(token);

      return user_uuid || "";
    }
  }

  const session = await auth();
  if (session && session.user && session.user.uuid) {
    user_uuid = session.user.uuid;
  }

  return user_uuid;
}

export async function getBearerToken() {
  const h = await headers();
  const auth = h.get("Authorization");
  if (!auth) {
    return "";
  }

  return auth.replace("Bearer ", "");
}

export async function getUserEmail() {
  let user_email = "";

  const session = await auth();
  if (session && session.user && session.user.email) {
    user_email = session.user.email;
  }

  return user_email;
}

export async function getUserInfo() {
  // 开发模式：返回mock用户
  if (process.env.NODE_ENV === 'development') {
    return {
      uuid: 'dev-user-uuid',
      email: 'dev@example.com',
      name: 'Development User',
      image: '/imgs/users/1.png'
    };
  }

  let user_uuid = await getUserUuid();

  if (!user_uuid) {
    return;
  }

  const user = await findUserByUuid(user_uuid);

  return user;
}

// 创建密码用户
export async function createPasswordUser(data: {
  email: string;
  username?: string;
  password: string;
  nickname?: string;
  locale?: string;
}): Promise<User> {
  // 检查邮箱是否已存在（credentials provider）
  const existingEmailUser = await findUserByEmail(data.email);
  if (existingEmailUser && existingEmailUser.signin_provider === 'credentials') {
    throw new Error('Email already registered with password');
  }

  // 检查用户名是否已存在
  if (data.username) {
    const existingUsernameUser = await findUserByUsername(data.username);
    if (existingUsernameUser) {
      throw new Error('Username already taken');
    }
  }

  // 哈希密码
  const passwordHash = await bcrypt.hash(data.password, 12);

  const user: User = {
    uuid: getUuid(),
    email: data.email,
    username: data.username,
    password_hash: passwordHash,
    nickname: data.nickname || data.username || data.email.split('@')[0],
    avatar_url: '',
    signin_provider: 'credentials',
    signin_type: 'password',
    email_verified: false,
    locale: data.locale || 'en',
    created_at: new Date(),
  };

  return await saveUser(user);
}

// 通过邮箱或用户名查找用户
export async function getUserByEmailOrUsername(identifier: string) {
  return await findUserByEmailOrUsername(identifier);
}

// 验证密码
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// 检查用户名是否可用
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const user = await findUserByUsername(username);
  return !user;
}

// 检查邮箱是否已用于密码登录
export async function isEmailAvailableForPassword(email: string): Promise<boolean> {
  const user = await findUserByEmail(email);
  // 如果邮箱不存在，或者存在但不是credentials provider，则可用
  return !user || user.signin_provider !== 'credentials';
}
