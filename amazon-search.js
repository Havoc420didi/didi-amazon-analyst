const { chromium } = require('playwright');

(async () => {
  // 启动浏览器
  const browser = await chromium.launch({ 
    headless: false, // 显示浏览器窗口
    slowMo: 2000, // 减慢操作速度以便观察
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('正在搜索 hair clips...');
    // 直接访问搜索结果页面
    const searchUrl = 'https://www.amazon.com/s?k=hair+clips&ref=nb_sb_noss';
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    
    // 等待页面加载完成
    await page.waitForTimeout(5000);
    
    // 检查是否需要处理验证码
    try {
      const captcha = await page.locator('#captchacharacters');
      if (await captcha.isVisible()) {
        console.log('检测到验证码，请手动处理验证码...');
        console.log('处理完成后，脚本将继续运行...');
        
        // 等待验证码处理完成
        await page.waitForFunction(() => {
          return !document.querySelector('#captchacharacters') || 
                 !document.querySelector('#captchacharacters').offsetParent;
        }, { timeout: 60000 });
        
        await page.waitForTimeout(3000);
      }
    } catch (error) {
      // 没有验证码，继续
    }
    
    // 等待搜索结果加载
    await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 });
    
    console.log('正在分析搜索结果...');
    
    // 尝试按销量排序
    try {
      const sortDropdown = await page.locator('#s-result-sort-select');
      if (await sortDropdown.isVisible()) {
        await sortDropdown.selectOption('popularity-rank');
        await page.waitForTimeout(3000);
      }
    } catch (error) {
      console.log('无法找到排序选项，使用默认排序');
    }
    
    // 获取搜索结果
    const products = await page.locator('[data-component-type="s-search-result"]').all();
    
    console.log(`找到 ${products.length} 个商品`);
    
    // 查找第一个有效的商品链接
    let productFound = false;
    for (let i = 0; i < Math.min(5, products.length); i++) {
      try {
        const product = products[i];
        
        // 获取商品标题
        const titleElement = await product.locator('h2 a span').first();
        const title = await titleElement.textContent();
        
        // 获取商品链接
        const linkElement = await product.locator('h2 a').first();
        const href = await linkElement.getAttribute('href');
        
        // 获取评分和评论数
        const ratingElement = await product.locator('[aria-label*="stars"]').first();
        const reviewCountElement = await product.locator('[aria-label*="stars"]').first().locator('..').locator('a').last();
        
        const rating = await ratingElement.getAttribute('aria-label') || 'N/A';
        const reviewCount = await reviewCountElement.textContent() || 'N/A';
        
        console.log(`商品 ${i + 1}:`);
        console.log(`标题: ${title}`);
        console.log(`评分: ${rating}`);
        console.log(`评论数: ${reviewCount}`);
        
        if (href && !productFound) {
          console.log('正在打开商品详情页...');
          // 点击商品链接
          await linkElement.click();
          productFound = true;
          
          // 等待商品详情页加载
          await page.waitForSelector('#productTitle', { timeout: 10000 });
          
          // 获取商品详情信息
          const productTitle = await page.locator('#productTitle').textContent();
          console.log(`商品标题: ${productTitle}`);
          
          // 获取价格
          try {
            const priceElement = await page.locator('.a-price-whole').first();
            const price = await priceElement.textContent();
            console.log(`价格: $${price}`);
          } catch (error) {
            console.log('无法获取价格信息');
          }
          
          // 获取商品图片
          try {
            const imageElement = await page.locator('#landingImage').first();
            const imageSrc = await imageElement.getAttribute('src');
            console.log(`商品图片: ${imageSrc}`);
          } catch (error) {
            console.log('无法获取商品图片');
          }
          
          // 获取商品描述
          try {
            const descriptionElement = await page.locator('#feature-bullets ul').first();
            const description = await descriptionElement.textContent();
            console.log(`商品描述: ${description}`);
          } catch (error) {
            console.log('无法获取商品描述');
          }
          
          console.log('任务完成！浏览器将保持打开状态，您可以继续浏览。');
          break;
        }
      } catch (error) {
        console.log(`处理商品 ${i + 1} 时出错:`, error.message);
        continue;
      }
    }
    
    if (!productFound) {
      console.log('未找到可访问的商品链接');
    }
    
    // 保持浏览器打开
    console.log('浏览器将保持打开状态，按 Ctrl+C 结束程序');
    await new Promise(() => {}); // 保持程序运行
    
  } catch (error) {
    console.error('执行过程中出错:', error);
  } finally {
    // 不自动关闭浏览器，让用户手动关闭
    // await browser.close();
  }
})();