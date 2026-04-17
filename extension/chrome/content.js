// Content script to extract page metadata
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_METADATA') {
    const metadata = {
      title: document.title,
      url: window.location.href,
      previewImage: getPreviewImage()
    };
    sendResponse(metadata);
  }
});

function getPreviewImage() {
  // 1. Try Open Graph image
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage && ogImage.content) return ogImage.content;

  // 2. Try Twitter image
  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  if (twitterImage && twitterImage.content) return twitterImage.content;

  // 3. Try Schema.org Product image
  const productImages = document.querySelectorAll('[itemprop="image"]');
  if (productImages.length > 0) return productImages[0].src || productImages[0].content;

  // 4. Try common product image classes/IDs
  const commonProductSelectors = [
    '.product-image', '.main-image', '#main-image', 
    '[data-testid="product-image"]', '.product-gallery__image'
  ];
  for (const selector of commonProductSelectors) {
    const img = document.querySelector(selector);
    if (img && img.src) return img.src;
  }

  // 5. Fallback: find the largest image in the top part of the page
  const images = Array.from(document.getElementsByTagName('img'));
  const largeImages = images.filter(img => {
    const rect = img.getBoundingClientRect();
    return rect.width > 200 && rect.height > 200;
  });
  
  if (largeImages.length > 0) {
    return largeImages[0].src;
  }

  return null;
}
