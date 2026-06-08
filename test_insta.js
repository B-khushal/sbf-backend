const https = require('https');

function testPicuki() {
  const shortcode = 'DUu1Noejg69';
  const url = `https://www.picuki.com/media/${shortcode}`;
  console.log("Fetching from Picuki:", url);
  
  const options = {
    hostname: 'www.picuki.com',
    path: `/media/${shortcode}`,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  const req = https.request(options, (res) => {
    console.log("Status Code:", res.statusCode);
    let html = '';
    res.on('data', (chunk) => html += chunk);
    res.on('end', () => {
      console.log("HTML length:", html.length);
      
      // Let's search for likes and comments count in the Picuki HTML
      // Picuki has likes count in a class like "likes_like" or stats
      const likesMatch = html.match(/class="likes"[\s\S]*?>([\s\S]*?)<\/span>/i) || html.match(/class="icon-heart"[\s\S]*?>([\s\S]*?)<\/span>/i) || html.match(/likes-count">([\s\S]*?)<\/span>/i);
      console.log("Likes Match:", likesMatch ? likesMatch[0] : "Not found");
      
      const commentsMatch = html.match(/class="comments"[\s\S]*?>([\s\S]*?)<\/span>/i) || html.match(/class="icon-bubble"[\s\S]*?>([\s\S]*?)<\/span>/i);
      console.log("Comments Match:", commentsMatch ? commentsMatch[0] : "Not found");
      
      const imgMatch = html.match(/<img[^>]+src="([^"]+)"/gi);
      console.log("Images found count:", imgMatch ? imgMatch.length : 0);
      if (imgMatch) {
        console.log("First 3 image tags:");
        imgMatch.slice(0, 3).forEach((tag, idx) => console.log(`${idx}: ${tag}`));
      }
    });
  });

  req.on('error', (err) => {
    console.error("Error:", err);
  });
  req.end();
}

testPicuki();
