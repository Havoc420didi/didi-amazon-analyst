import { NextRequest, NextResponse } from "next/server";
import { createPasswordUser, isEmailAvailableForPassword, isUsernameAvailable } from "@/services/user";
import { getClientIp } from "@/lib/ip";

export async function POST(request: NextRequest) {
  try {
    const { email, username, password } = await request.json();

    // 基础验证
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // 密码强度验证
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // 用户名格式验证（如果提供）
    if (username) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(username)) {
        return NextResponse.json(
          { error: "Username must be 3-20 characters long and contain only letters, numbers, and underscores" },
          { status: 400 }
        );
      }
    }

    // 检查邮箱是否已被密码用户使用
    const isEmailAvailable = await isEmailAvailableForPassword(email);
    if (!isEmailAvailable) {
      return NextResponse.json(
        { error: "Email already registered with password" },
        { status: 409 }
      );
    }

    // 检查用户名是否可用（如果提供）
    if (username) {
      const isUsernameAvailableResult = await isUsernameAvailable(username);
      if (!isUsernameAvailableResult) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 409 }
        );
      }
    }

    // 获取客户端IP
    const clientIp = getClientIp(request);

    // 创建用户
    const user = await createPasswordUser({
      email,
      username,
      password,
      locale: request.headers.get("accept-language")?.split(",")[0] || "en",
    });

    // 返回成功响应（不包含敏感信息）
    return NextResponse.json({
      success: true,
      user: {
        uuid: user.uuid,
        email: user.email,
        username: user.username,
        nickname: user.nickname,
      },
    });

  } catch (error: any) {
    console.error("Registration error:", error);

    // 处理特定错误
    if (error.message === "Email already registered with password") {
      return NextResponse.json(
        { error: "Email already registered with password" },
        { status: 409 }
      );
    }

    if (error.message === "Username already taken") {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // 通用错误响应
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}

// 检查用户名可用性的GET请求
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    const email = searchParams.get("email");

    if (username) {
      const available = await isUsernameAvailable(username);
      return NextResponse.json({ available });
    }

    if (email) {
      const available = await isEmailAvailableForPassword(email);
      return NextResponse.json({ available });
    }

    return NextResponse.json(
      { error: "Username or email parameter required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Check availability error:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}