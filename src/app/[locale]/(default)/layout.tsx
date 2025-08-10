import Footer from "@/components/blocks/footer";
import Header from "@/components/blocks/header";
import { ReactNode } from "react";
import { getLandingPage } from "@/services/page";

export default async function DefaultLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  try {
    const { locale } = await params;
    const page = await getLandingPage(locale);

    return (
      <>
        {page.header && <Header header={page.header} />}
        <main className="overflow-x-hidden">{children}</main>
        {page.footer && <Footer footer={page.footer} />}
      </>
    );
  } catch (error) {
    // 简化版本，如果加载页面数据失败
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Ops Helios</h1>
        <main className="overflow-x-hidden">{children}</main>
        <footer style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <p>© 2025 Ops Helios • Tepin Team</p>
        </footer>
      </div>
    );
  }
}
