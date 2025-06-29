import { getLandingPage } from "@/services/page";

export default async function SimplePage() {
  try {
    const page = await getLandingPage("zh");
    
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <header style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '3em', marginBottom: '10px', color: '#333' }}>
            🚀 Amazon Analyst
          </h1>
          <p style={{ fontSize: '1.2em', color: '#666' }}>
            您的 AI 亚马逊运营总监
          </p>
        </header>

        <section style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
          <h2 style={{ color: '#444', marginBottom: '20px' }}>核心功能</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h3>📊 实时销售追踪</h3>
              <p>精确到每个 SKU 的实时销售和利润分析，让您随时掌握业务健康状况。</p>
            </div>
            <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h3>📦 智能库存管理</h3>
              <p>预测补货需求，避免断货或库存积压，最大化资金效率。</p>
            </div>
            <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h3>🎯 广告活动优化</h3>
              <p>分析广告表现，提供关键词和出价优化建议，提升广告投资回报率。</p>
            </div>
            <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h3>🔍 竞争对手监控</h3>
              <p>追踪竞品的价格、评价、排名和关键词策略，知己知彼，百战不殆。</p>
            </div>
          </div>
        </section>

        <section style={{ maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
          <h2 style={{ color: '#444', marginBottom: '20px' }}>用户评价</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
              <p style={{ fontStyle: 'italic', marginBottom: '10px' }}>
                "使用 Amazon Analyst 后，我们的广告ACOS从35%降到了22%，库存周转率提升了40%。AI生成的运营建议非常精准！"
              </p>
              <strong>刘强东 - 3C电子产品大卖家</strong>
            </div>
            <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
              <p style={{ fontStyle: 'italic', marginBottom: '10px' }}>
                "最喜欢的是竞争对手监控功能，能实时发现跟卖和价格变动。月销售额增长了60%！"
              </p>
              <strong>Emma Rodriguez - 家居用品运营总监</strong>
            </div>
          </div>
        </section>

        <footer style={{ textAlign: 'center', marginTop: '40px', padding: '20px', borderTop: '1px solid #eee' }}>
          <p style={{ color: '#888' }}>
            🎉 服务器运行正常！时间: {new Date().toLocaleString()}
          </p>
          <div style={{ marginTop: '10px' }}>
            <a href="/" style={{ color: '#007bff', textDecoration: 'none', margin: '0 10px' }}>返回主页</a>
            <a href="/zh" style={{ color: '#007bff', textDecoration: 'none', margin: '0 10px' }}>中文版</a>
            <a href="/en" style={{ color: '#007bff', textDecoration: 'none', margin: '0 10px' }}>English</a>
          </div>
        </footer>
      </div>
    );
  } catch (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>⚠️ 加载错误</h1>
        <p>页面加载失败: {String(error)}</p>
        <p>时间: {new Date().toLocaleString()}</p>
      </div>
    );
  }
}