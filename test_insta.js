async function testEeImage() {
  const imageUrl = 'https://www.eeinstagram.com/images/DUu1Noejg69/1';
  console.log("Checking image URL using GET:", imageUrl);
  try {
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
      }
    });
    console.log("Status:", response.status);
    console.log("Headers:");
    for (const [key, val] of response.headers.entries()) {
      console.log(`  ${key}: ${val}`);
    }
  } catch (err) {
    console.log("Error:", err.message);
  }
}

testEeImage();
