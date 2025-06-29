export default function TestPage() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>🎉 Amazon Analyst 测试页面</h1>
      <p>如果您能看到这个页面，说明服务器正在正常运行！</p>
      <p>时间: {new Date().toLocaleString()}</p>
      
      <div style={{ marginTop: '20px' }}>
        <a href="/zh" style={{ color: 'blue', marginRight: '10px' }}>中文主页</a>
        <a href="/en" style={{ color: 'blue', marginRight: '10px' }}>English Home</a>
        <a href="/zh/analysis" style={{ color: 'blue' }}>数据分析页面</a>
      </div>
    </div>
  );
}