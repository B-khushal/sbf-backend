const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const CATEGORIES = [
  {
    name: 'Ordering & Checkout',
    slug: 'ordering-checkout',
    description: 'Everything about placing orders, customized bouquets, and checkout process.',
    icon: 'ShoppingBag',
    displayOrder: 1
  },
  {
    name: 'Flower & Bouquet Delivery',
    slug: 'flower-bouquet-delivery',
    description: 'Delivery areas across Hyderabad & Secunderabad, slots, charges, and guidelines.',
    icon: 'Truck',
    displayOrder: 2
  },
  {
    name: 'Cakes, Gifts, Plants & Combos',
    slug: 'cakes-gifts-combos',
    description: 'Freshly baked cakes, flower-cake combos, indoor plants, and seasonal blooms.',
    icon: 'Gift',
    displayOrder: 3
  },
  {
    name: 'Payments & Offers',
    slug: 'payments-offers',
    description: 'Razorpay payment methods, UPI, card security, and discount coupons.',
    icon: 'CreditCard',
    displayOrder: 4
  },
  {
    name: 'Order Tracking & Status',
    slug: 'order-tracking-status',
    description: 'Tracking your fresh delivery, understanding statuses, and delivery updates.',
    icon: 'Clock',
    displayOrder: 5
  },
  {
    name: 'Cancellations, Refunds & Issues',
    slug: 'cancellations-refunds',
    description: 'Perishable item policies, cancellations, reporting damages, and refunds.',
    icon: 'RefreshCw',
    displayOrder: 6
  },
  {
    name: 'Flower Care & Gifting',
    slug: 'flower-care-gifting',
    description: 'Pro tips to keep your blooms fresh longer, vase maintenance, and gift ideas.',
    icon: 'Heart',
    displayOrder: 7
  },
  {
    name: 'Account, Privacy & Support',
    slug: 'account-privacy-support',
    description: 'Store location in Mehdipatnam, contact channels, hours, and account management.',
    icon: 'ShieldCheck',
    displayOrder: 8
  }
];

const FAQS = [
  // A. Ordering & Checkout
  {
    categorySlug: 'ordering-checkout',
    question: 'How can I place an order on Spring Blossoms Florist?',
    answer: 'Placing an order is simple: Browse our fresh flower arrangements, cakes, or gifts online at sbflorist.in, select your desired product, choose any add-ons or custom card messages, enter the recipient\'s delivery address in Hyderabad or Secunderabad along with your preferred delivery date and time slot, and complete payment securely via Razorpay.',
    keywords: ['place order', 'how to order', 'buy flowers', 'booking'],
    displayLocations: ['faq_page', 'home'],
    isFeatured: true,
    displayOrder: 1
  },
  {
    categorySlug: 'ordering-checkout',
    question: 'Can I order flowers online in Hyderabad?',
    answer: 'Yes! Spring Blossoms Florist is a premier Hyderabad-based florist located in Mehdipatnam. We handcraft and hand-deliver fresh floral bouquets, luxury arrangements, roses, cakes, and gift hampers across Hyderabad and Secunderabad directly from our local floral studio.',
    keywords: ['order online hyderabad', 'flower delivery hyderabad', 'florist in hyderabad'],
    displayLocations: ['faq_page', 'home', 'category'],
    isFeatured: true,
    displayOrder: 2
  },
  {
    categorySlug: 'ordering-checkout',
    question: 'Can I order a bouquet for someone else?',
    answer: 'Absolutely. During checkout, you can specify the recipient\'s name, delivery address, and phone number, while entering your own contact details as the billing person. You can also write a personalized gift card message that will be printed and enclosed with the flowers.',
    keywords: ['send flowers to someone', 'gift for friend', 'recipient address'],
    displayLocations: ['faq_page', 'product'],
    isFeatured: false,
    displayOrder: 3
  },
  {
    categorySlug: 'ordering-checkout',
    question: 'Can I add a personal message with my flowers?',
    answer: 'Yes! During checkout, there is a dedicated "Gift Message / Card Message" box where you can compose your personalized message for birthdays, anniversaries, congratulations, or romantic occasions. We print this neatly on a complimentary Spring Blossoms gift card.',
    keywords: ['personal message', 'gift note', 'greeting card', 'card message'],
    displayLocations: ['faq_page', 'product', 'home'],
    isFeatured: true,
    displayOrder: 4
  },
  {
    categorySlug: 'ordering-checkout',
    question: 'Can I order flowers, cakes, and gifts together?',
    answer: 'Yes! You can explore our pre-curated Combos collection or add individual bouquets, freshly baked designer cakes, chocolates, and teddy bears to your cart in a single checkout. Our delivery team coordinates arrival so that both flowers and cake are delivered together in pristine condition.',
    keywords: ['flowers and cake', 'combo order', 'gift hampers'],
    displayLocations: ['faq_page', 'combos'],
    isFeatured: false,
    displayOrder: 5
  },
  {
    categorySlug: 'ordering-checkout',
    question: 'Can I order multiple products in one order?',
    answer: 'Yes, you can add multiple bouquets, cakes, indoor plants, and add-on items to your shopping cart. If they are intended for the same recipient and address, they will be delivered together in one scheduled delivery.',
    keywords: ['multiple products', 'cart items', 'bulk order'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 6
  },
  {
    categorySlug: 'ordering-checkout',
    question: 'Can I place an order without creating an account?',
    answer: 'Yes, guest checkout is supported for fast ordering. However, creating or logging into an account allows you to track past orders, save delivery addresses, view order invoices, and earn loyalty benefits.',
    keywords: ['guest checkout', 'without account', 'sign in'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 7
  },
  {
    categorySlug: 'ordering-checkout',
    question: 'How can I check whether my order was placed successfully?',
    answer: 'Upon successful payment, an instant on-screen order confirmation with your unique Order ID will be displayed. You will also receive an order confirmation email and WhatsApp/SMS notification with complete order and delivery details. You can also review it anytime under \'My Orders\'.',
    keywords: ['order confirmation', 'check order status', 'order placed'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 8
  },
  {
    categorySlug: 'ordering-checkout',
    question: 'What should I do if I accidentally place the same order twice?',
    answer: 'If you accidentally placed a duplicate order, please contact our support team immediately via phone or WhatsApp at +91 9949683222 or email contact@sbflorist.in with both Order IDs. If notified before the arrangement is prepared or dispatched, our team will cancel the duplicate order and initiate a refund.',
    keywords: ['duplicate order', 'accidental order', 'double payment'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: false,
    displayOrder: 9
  },
  {
    categorySlug: 'ordering-checkout',
    question: 'Can I request a special arrangement or customized bouquet?',
    answer: 'Yes! As an artisanal floral boutique, our florists specialize in bespoke luxury arrangements, custom flower boxes, and grand floral installations. Contact us on WhatsApp at +91 9949683222 with your preferred flowers, color palette, or reference photos, and our master florists will tailor an arrangement for you.',
    keywords: ['custom bouquet', 'bespoke flowers', 'special arrangement', 'customized flowers'],
    displayLocations: ['faq_page', 'category', 'contact'],
    isFeatured: true,
    displayOrder: 10
  },

  // B. Flower & Bouquet Delivery
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Do you offer flower delivery in Hyderabad?',
    answer: 'Yes! Spring Blossoms Florist delivers across all major localities in Hyderabad including Jubilee Hills, Banjara Hills, Gachibowli, HITEC City, Kondapur, Madhapur, Mehdipatnam, Kukatpally, Begumpet, Somajiguda, and surrounding neighborhoods.',
    keywords: ['hyderabad delivery', 'service area hyderabad', 'localities'],
    displayLocations: ['faq_page', 'home', 'category'],
    isFeatured: true,
    displayOrder: 11
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Do you deliver flowers in Secunderabad?',
    answer: 'Yes, we deliver across Secunderabad including Sainikpuri, Marredpally, Trimulgherry, Bowenpally, Begumpet, and surrounding zones. Delivery fees are calculated dynamically based on distance during checkout.',
    keywords: ['secunderabad delivery', 'deliver in secunderabad'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 12
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Do you offer same-day flower delivery?',
    answer: 'Yes! We offer same-day delivery throughout Hyderabad and Secunderabad for orders placed before our daily afternoon cut-off time (typically 4:00 PM IST). Deliveries are dispatched using our dedicated in-house delivery team to ensure maximum bloom freshness.',
    keywords: ['same day delivery', 'express delivery', 'fast flower delivery'],
    displayLocations: ['faq_page', 'home', 'product'],
    isFeatured: true,
    displayOrder: 13
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Can I schedule a delivery for a future date?',
    answer: 'Yes! During checkout, you can select any future date from the interactive delivery calendar. You can schedule birthdays, anniversaries, Valentine\'s Day, and festive occasions weeks in advance, and our florists will prepare fresh blooms on the morning of your chosen date.',
    keywords: ['future delivery', 'advance booking', 'schedule date'],
    displayLocations: ['faq_page', 'product'],
    isFeatured: false,
    displayOrder: 14
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Can I request a particular delivery time?',
    answer: 'During checkout, you can choose from available delivery slots (e.g., Morning, Standard Afternoon, or Evening). While traffic conditions and weather in Hyderabad may cause minor variances (typically within ±30 to 45 minutes), our team strives to deliver within your chosen window.',
    keywords: ['delivery slot', 'specific time', 'delivery window'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 15
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Is midnight flower delivery available?',
    answer: 'Midnight delivery is currently not offered as a standard online checkout slot. However, for milestone celebrations, please contact our support team on WhatsApp (+91 9949683222) at least 24 hours in advance to check if custom late-evening delivery can be arranged.',
    keywords: ['midnight delivery', '12 am delivery', 'midnight flower delivery'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 16
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'How can I check delivery availability for my address?',
    answer: 'Enter your delivery pincode or area name on the product page or checkout step. If your address is in Hyderabad or Secunderabad, the system will confirm delivery availability and display the applicable delivery slots and charges.',
    keywords: ['check pincode', 'delivery availability', 'serviceable pincode'],
    displayLocations: ['faq_page', 'product'],
    isFeatured: false,
    displayOrder: 17
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'What are your delivery charges?',
    answer: 'Delivery charges are calculated based on your delivery address and distance from our floral studio in Mehdipatnam. Standard delivery charges range from ₹49 to ₹199 depending on the distance, and the exact fee is displayed transparently at checkout before payment.',
    keywords: ['delivery charge', 'delivery fee', 'shipping cost'],
    displayLocations: ['faq_page', 'home'],
    isFeatured: true,
    displayOrder: 18
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Is free delivery available for first-time customers?',
    answer: 'We occasionally offer promotional coupon codes for free delivery or welcome discounts for new customers. Check the promotional banner on our homepage or subscribe to our newsletter for active discount codes.',
    keywords: ['free delivery first order', 'new customer offer', 'discount'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 19
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Is free delivery available on orders above ₹999?',
    answer: 'Yes! We provide free standard delivery on orders above ₹999 within our primary service zones in Hyderabad. If your cart qualifies, the free delivery option will be automatically applied at checkout.',
    keywords: ['free delivery 999', 'free shipping threshold', 'minimum order free delivery'],
    displayLocations: ['faq_page', 'home'],
    isFeatured: true,
    displayOrder: 20
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Which areas of Hyderabad and Secunderabad do you serve?',
    answer: 'We cover all central, western, and northern Hyderabad neighborhoods, including Mehdipatnam, Banjara Hills, Jubilee Hills, Gachibowli, HITEC City, Financial District, Kondapur, Madhapur, Kukatpally, Miyapur, Ameerpet, Begumpet, Secunderabad, Sainikpuri, Somajiguda, Abids, and Himayatnagar.',
    keywords: ['areas served', 'delivery locations', 'pin codes covered'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 21
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Can I change the delivery address after placing an order?',
    answer: 'If your order has not yet been dispatched, you can request an address update by contacting our support team via WhatsApp or call at +91 9949683222 with your Order ID. Please note that once the courier has left our floral studio, address changes cannot be accommodated for perishable items.',
    keywords: ['change address', 'update delivery address', 'address modification'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 22
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'What happens if the recipient is unavailable?',
    answer: 'Because flowers and cakes are perishable items, our delivery executive will attempt to call the recipient and sender. If unavailable, the order may be safely handed to a building security guard, neighbor, or front reception upon approval. Redelivery on a later date requires a fresh preparation fee and shipping charge.',
    keywords: ['recipient unavailable', 'not at home', 'delivery attempt'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 23
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'What happens if the delivery address is incorrect?',
    answer: 'Please ensure the address and recipient contact number are accurate during checkout. If an incorrect address is provided and the driver cannot reach the recipient, the order may be returned to our studio. Additional delivery charges apply if redelivery to a corrected address is requested.',
    keywords: ['wrong address', 'address error', 'incorrect location'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 24
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Can the recipient receive the order without seeing the sender\'s name?',
    answer: 'Yes! If you wish to send flowers anonymously or as a surprise, simply leave the sender name blank on the card message or mention \'Anonymous\' in the delivery instructions at checkout. We protect your privacy and will not disclose your name to the recipient unless requested for legal or security compliance.',
    keywords: ['anonymous delivery', 'secret admirer', 'surprise gift'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 25
  },
  {
    categorySlug: 'flower-bouquet-delivery',
    question: 'Will I be contacted if a delivery issue occurs?',
    answer: 'Yes. If our delivery team experiences difficulty locating the address, gate access restrictions, or recipient unavailability, we will promptly contact the sender via phone or WhatsApp to resolve the issue before leaving the location.',
    keywords: ['delivery issue', 'contact sender', 'driver call'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 26
  },

  // C. Cakes, Gifts, Plants & Combos
  {
    categorySlug: 'cakes-gifts-combos',
    question: 'Can I order cake delivery in Hyderabad?',
    answer: 'Yes! We offer a delicious assortment of freshly baked gourmet cakes including Belgian Chocolate, Black Forest, Red Velvet, Butterscotch, Fresh Fruit, and Pineapple cakes, baked fresh to order and hand-delivered alongside your flowers.',
    keywords: ['cake delivery hyderabad', 'order cakes online', 'fresh cakes'],
    displayLocations: ['faq_page', 'cakes', 'home'],
    isFeatured: true,
    displayOrder: 27
  },
  {
    categorySlug: 'cakes-gifts-combos',
    question: 'Can I send flowers and cake together?',
    answer: 'Yes! Flowers and cake are our most popular celebratory pairing. You can choose from our curated combos or add any cake from our bakery section to your flower order. Both items will be delivered together by our delivery executive.',
    keywords: ['flowers and cake', 'combo delivery', 'send flowers with cake'],
    displayLocations: ['faq_page', 'cakes', 'combos'],
    isFeatured: true,
    displayOrder: 28
  },
  {
    categorySlug: 'cakes-gifts-combos',
    question: 'Are flower-and-cake gift combos available?',
    answer: 'Yes, we feature an exclusive collection of curated flower-and-cake gift combos, featuring fresh red roses, mixed carnations, or premium lilies paired with delectable designer cakes, chocolates, and greeting cards at value combo prices.',
    keywords: ['gift combos', 'flower and cake combo', 'celebration combo'],
    displayLocations: ['faq_page', 'combos'],
    isFeatured: true,
    displayOrder: 29
  },
  {
    categorySlug: 'cakes-gifts-combos',
    question: 'Can I order roses, lilies, sunflowers, and other seasonal flowers?',
    answer: 'Yes! Our catalog features Dutch red roses, pink roses, yellow roses, oriental and Asiatic lilies, gerberas, orchids, carnations, and seasonal flowers such as sunflowers and chrysanthemums, subject to seasonal market availability.',
    keywords: ['roses', 'lilies', 'sunflowers', 'carnations', 'orchids', 'flower varieties'],
    displayLocations: ['faq_page', 'category'],
    isFeatured: false,
    displayOrder: 30
  },
  {
    categorySlug: 'cakes-gifts-combos',
    question: 'Can I order plants as gifts?',
    answer: 'Yes, we offer long-lasting indoor plants including Money Plants, Sansevieria (Snake Plant), Peace Lily, Jade Plants, and Lucky Bamboo arrangements housed in decorative ceramic pots, perfect for eco-friendly housewarmings and corporate gifting.',
    keywords: ['plant delivery', 'indoor plants', 'gift plants'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 31
  },
  {
    categorySlug: 'cakes-gifts-combos',
    question: 'Can I request a particular flower colour?',
    answer: 'Many bouquets allow you to select specific rose colors (Red, Pink, Yellow, White, Peach). If you have a specific color preference not listed online, please mention it in the order notes or chat with us on WhatsApp at +91 9949683222.',
    keywords: ['flower colour', 'red roses', 'pink roses', 'custom colour'],
    displayLocations: ['faq_page', 'category'],
    isFeatured: false,
    displayOrder: 32
  },
  {
    categorySlug: 'cakes-gifts-combos',
    question: 'Are all products available for same-day delivery?',
    answer: 'Most fresh flower bouquets, standard cakes, and chocolates are available for same-day delivery when ordered before our afternoon cutoff. Certain customized multi-tier cakes, exotic imported blooms, or specialized gift baskets may require 24 hours advance notice.',
    keywords: ['same day availability', 'instant delivery products'],
    displayLocations: ['faq_page', 'product'],
    isFeatured: false,
    displayOrder: 33
  },
  {
    categorySlug: 'cakes-gifts-combos',
    question: 'Can a product be substituted if it is unavailable?',
    answer: 'Due to daily farm fresh supply fluctuations, if a particular secondary filler flower or wrapper color is out of stock, our florists may substitute it with an item of equal or greater value, maintaining the overall color scheme, volume, and style of your arrangement.',
    keywords: ['flower substitution', 'out of stock', 'replacement'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 34
  },
  {
    categorySlug: 'cakes-gifts-combos',
    question: 'Are cake flavours, sizes, or variants selectable?',
    answer: 'Yes, our cakes are available in standard 500g (0.5 kg) and 1kg sizes, with eggless options available for all flavors. You can select your preferred weight and dietary variant on the product page before adding to cart.',
    keywords: ['cake size', '500g cake', '1kg cake', 'eggless cake', 'cake flavours'],
    displayLocations: ['faq_page', 'cakes'],
    isFeatured: false,
    displayOrder: 35
  },
  {
    categorySlug: 'cakes-gifts-combos',
    question: 'How can I find products for birthdays and anniversaries?',
    answer: 'You can explore our curated \'Occasions\' menu in the navigation bar, where we have categorized perfect arrangements for Birthdays, Anniversaries, Romance, Congratulations, Get Well Soon, and Festive Celebrations.',
    keywords: ['birthday flowers', 'anniversary bouquet', 'occasions'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 36
  },

  // D. Payments & Offers
  {
    categorySlug: 'payments-offers',
    question: 'Which payment methods are accepted?',
    answer: 'We accept all major secure digital payment methods powered by Razorpay: UPI (Google Pay, PhonePe, Paytm, BHIM, CRED), Credit Cards (Visa, MasterCard, RuPay, Diners), Debit Cards, and Net Banking from all major Indian banks.',
    keywords: ['payment methods', 'upi', 'google pay', 'phonepe', 'credit card', 'netbanking'],
    displayLocations: ['faq_page', 'home'],
    isFeatured: true,
    displayOrder: 37
  },
  {
    categorySlug: 'payments-offers',
    question: 'Is online payment secure?',
    answer: 'Yes, 100% secure. All online transactions are encrypted via 256-bit SSL protocols and processed directly through Razorpay\'s PCI-DSS Level 1 compliant payment gateway. Spring Blossoms Florist never stores your bank account, card numbers, or CVV.',
    keywords: ['payment security', 'safe checkout', 'ssl encryption', 'razorpay'],
    displayLocations: ['faq_page'],
    isFeatured: true,
    displayOrder: 38
  },
  {
    categorySlug: 'payments-offers',
    question: 'What should I do if my payment is deducted but no order appears?',
    answer: 'In rare cases of internet interruption or bank gateway delays, if money is debited from your account but no confirmation screen appears, please wait 5-10 minutes. If the order is not auto-created, send your payment transaction ID or UPI UTR number to us on WhatsApp at +91 9949683222 or email contact@sbflorist.in. If the bank fails the transaction, your bank will auto-refund the amount to your source account within 3 to 5 business days.',
    keywords: ['payment deducted', 'money debited', 'order not placed', 'failed transaction'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: false,
    displayOrder: 39
  },
  {
    categorySlug: 'payments-offers',
    question: 'Can I use a coupon or promotional offer?',
    answer: 'Yes! If you have a promo code, enter it in the \'Apply Coupon\' box on the checkout page before completing payment. The discount will instantly recalculate your final payable total.',
    keywords: ['coupon code', 'discount coupon', 'promo code'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 40
  },
  {
    categorySlug: 'payments-offers',
    question: 'Can I apply a discount after completing payment?',
    answer: 'Coupons and discounts must be applied prior to completing payment at checkout. Once a transaction is processed, discounts cannot be applied retroactively to an existing order.',
    keywords: ['retroactive discount', 'apply coupon after payment'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 41
  },
  {
    categorySlug: 'payments-offers',
    question: 'Why is my payment pending or unsuccessful?',
    answer: 'Payment failures typically occur due to bank server timeouts, incorrect OTP/UPI PIN entries, or insufficient funds. Please try using an alternative payment method (e.g. UPI QR or card) or contact your issuing bank if failures persist.',
    keywords: ['payment failed', 'transaction failed', 'pending payment'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 42
  },
  {
    categorySlug: 'payments-offers',
    question: 'How can I verify whether my payment was successful?',
    answer: 'Upon successful payment, you will see an immediate \'Order Placed\' confirmation screen with your Order Number. You will also receive an instant confirmation email and WhatsApp alert.',
    keywords: ['verify payment', 'payment status'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 43
  },
  {
    categorySlug: 'payments-offers',
    question: 'Will I receive an order confirmation after payment?',
    answer: 'Yes! You will receive an immediate confirmation email and WhatsApp message containing your full order summary, delivery date, recipient details, and a digital invoice download link.',
    keywords: ['order confirmation', 'invoice', 'email receipt'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 44
  },

  // E. Order Tracking & Status
  {
    categorySlug: 'order-tracking-status',
    question: 'How can I check my order status?',
    answer: 'You can check your order status anytime by visiting the \'Track Order\' link in our header or footer and entering your Order ID and phone number. Logged-in customers can also view the status under \'My Account\' > \'Order History\'.',
    keywords: ['check order status', 'track order', 'where is my order'],
    displayLocations: ['faq_page', 'home', 'contact'],
    isFeatured: true,
    displayOrder: 45
  },
  {
    categorySlug: 'order-tracking-status',
    question: 'How will I know when my order is confirmed?',
    answer: 'As soon as your payment is processed, your order status updates to \'Confirmed\' and our floral design team is notified. You will receive an automated confirmation SMS/WhatsApp message.',
    keywords: ['order confirmed', 'order notification'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 46
  },
  {
    categorySlug: 'order-tracking-status',
    question: 'What do the different order statuses mean?',
    answer: '<strong>Pending:</strong> Payment is being verified.<br/><strong>Confirmed:</strong> Payment received and order scheduled.<br/><strong>Preparing:</strong> Florists are handcrafting your floral arrangement / baking your cake.<br/><strong>Out for Delivery:</strong> Handed over to our delivery partner for transit.<br/><strong>Delivered:</strong> Successfully handed over at the recipient\'s location.',
    keywords: ['order statuses', 'pending', 'confirmed', 'preparing', 'delivered'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 47
  },
  {
    categorySlug: 'order-tracking-status',
    question: 'Can I track my delivery in real time?',
    answer: 'When our in-house delivery partner departs for your recipient\'s address, your order status updates to \'Out for Delivery\'. Our driver coordinates directly with the recipient or sender upon arrival.',
    keywords: ['real time tracking', 'live tracking', 'delivery partner'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 48
  },
  {
    categorySlug: 'order-tracking-status',
    question: 'What should I do if my order is delayed?',
    answer: 'While our team strives to meet delivery windows, occasional severe traffic or heavy monsoon rain in Hyderabad may cause minor delays. If your order is past its estimated delivery window, please message us on WhatsApp at +91 9949683222 for an immediate dispatch update.',
    keywords: ['delivery delay', 'late delivery', 'order delayed'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: false,
    displayOrder: 49
  },
  {
    categorySlug: 'order-tracking-status',
    question: 'What should I do if the order status says delivered but the recipient has not received it?',
    answer: 'Please verify with building security, front desk reception, or family members at the delivery address first, as floral deliveries to offices or gated communities are often accepted on the recipient\'s behalf. If not found, contact us immediately on WhatsApp (+91 9949683222) with your Order ID, and our team will contact the delivery driver.',
    keywords: ['marked delivered but not received', 'missing delivery'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: false,
    displayOrder: 50
  },
  {
    categorySlug: 'order-tracking-status',
    question: 'Can I contact customer support about an existing order?',
    answer: 'Yes! Our customer support team is available Monday to Sunday from 9:00 AM to 11:00 PM IST via WhatsApp/Phone at +91 9949683222 or email at contact@sbflorist.in. Always mention your Order ID for faster resolution.',
    keywords: ['customer support', 'help with order', 'support contact'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: true,
    displayOrder: 51
  },

  // F. Cancellations, Refunds & Issues
  {
    categorySlug: 'cancellations-refunds',
    question: 'Can I cancel an order after placing it?',
    answer: 'Because fresh cut flowers and gourmet cakes are perishable items prepared specifically for each order, cancellations can only be accepted if requested at least 4 hours before the scheduled delivery slot, or before our florists have begun crafting the arrangement. Once an order is \'Preparing\' or \'Out for Delivery\', it cannot be cancelled.',
    keywords: ['cancel order', 'cancellation policy', 'cancel flowers'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: true,
    displayOrder: 52
  },
  {
    categorySlug: 'cancellations-refunds',
    question: 'Can I modify an order after confirmation?',
    answer: 'To modify the card message, delivery date, or delivery address, please contact us immediately on WhatsApp at +91 9949683222. Modifications are accommodated free of charge if the arrangement has not yet been prepared or dispatched.',
    keywords: ['modify order', 'change card message', 'change order details'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 53
  },
  {
    categorySlug: 'cancellations-refunds',
    question: 'How do I request a refund?',
    answer: 'For orders eligible for cancellation under our policy, refund requests should be sent via WhatsApp (+91 9949683222) or email (contact@sbflorist.in) quoting your Order ID and reason for cancellation.',
    keywords: ['request refund', 'money back', 'refund process'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 54
  },
  {
    categorySlug: 'cancellations-refunds',
    question: 'How long does a refund take?',
    answer: 'Once an eligible refund is approved by our management team, the amount is refunded to your original payment method (via Razorpay). Bank processing typically takes 5 to 7 business days to reflect in your credit card or bank account.',
    keywords: ['refund time', 'how long refund takes', 'refund timeline'],
    displayLocations: ['faq_page'],
    isFeatured: true,
    displayOrder: 55
  },
  {
    categorySlug: 'cancellations-refunds',
    question: 'What happens if an order is cancelled by the store?',
    answer: 'In rare circumstances where delivery is impossible due to force majeure, extreme weather closures, or unforeseen flower availability issues, we will notify you immediately and issue a 100% full refund to your original payment method.',
    keywords: ['store cancellation', 'florist cancelled', 'full refund'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 56
  },
  {
    categorySlug: 'cancellations-refunds',
    question: 'What should I do if I receive the wrong product?',
    answer: 'If the delivered product does not match your order, please take a clear photograph of the received item and send it to our WhatsApp support (+91 9949683222) within 2 hours of delivery. Our quality manager will review and arrange an immediate replacement or suitable resolution.',
    keywords: ['wrong product received', 'incorrect item', 'wrong flowers'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: false,
    displayOrder: 57
  },
  {
    categorySlug: 'cancellations-refunds',
    question: 'What should I do if flowers or a cake arrive damaged?',
    answer: 'While our delivery team takes extreme care hand-delivering all delicate arrangements, transit damage can very rarely occur. Please take a clear photo of the damaged blooms or cake immediately upon receipt and send it to +91 9949683222 within 2 hours. We will arrange a prompt replacement or refund.',
    keywords: ['damaged flowers', 'damaged cake', 'broken flowers', 'transit damage'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: true,
    displayOrder: 58
  },
  {
    categorySlug: 'cancellations-refunds',
    question: 'How can I report a quality issue?',
    answer: 'Customer satisfaction is our utmost priority. To report a freshness or quality issue, please share photos and your Order ID with us on WhatsApp at +91 9949683222 or email contact@sbflorist.in within 4 hours of receipt.',
    keywords: ['report quality', 'poor quality', 'flower freshness', 'complaint'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: false,
    displayOrder: 59
  },
  {
    categorySlug: 'cancellations-refunds',
    question: 'Are perishable products eligible for returns?',
    answer: 'Due to the perishable nature of fresh flowers, foliage, cakes, and gourmet foods, physical returns are not accepted once delivered. If there is a verified quality or damage concern, we provide replacements or refunds rather than requiring physical return.',
    keywords: ['returns policy', 'return flowers', 'perishable returns'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 60
  },

  // G. Flower Care & Gifting
  {
    categorySlug: 'flower-care-gifting',
    question: 'How can I keep fresh flowers for longer?',
    answer: 'To maximize vase life:<br/>1. Cut 1-2 cm off the stems at a 45-degree angle under running water.<br/>2. Place in a clean vase filled with fresh, cool water.<br/>3. Remove leaves that sit below the water level.<br/>4. Keep flowers away from direct sunlight, heating vents, ceiling fans, and ripening fruits.<br/>5. Replace vase water every 1-2 days.',
    keywords: ['flower care', 'fresh flowers longer', 'vase life', 'flower tips'],
    displayLocations: ['faq_page', 'product', 'category'],
    isFeatured: true,
    displayOrder: 61
  },
  {
    categorySlug: 'flower-care-gifting',
    question: 'How often should I change the water in a flower vase?',
    answer: 'Change the water every 24 to 48 hours. Fresh water prevents bacterial growth in the vase, keeping flower stems unclogged and allowing them to drink water efficiently for up to 5-7 days.',
    keywords: ['change water', 'vase water', 'water frequency'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 62
  },
  {
    categorySlug: 'flower-care-gifting',
    question: 'How should I care for roses?',
    answer: 'Upon receiving your rose bouquet, unwrap the wrapping paper, trim stem bases diagonally by 1 inch, and place them in deep, cold water. If guard petals on outer edges appear naturally slightly discolored, you can gently peel them off to reveal pristine inner petals.',
    keywords: ['rose care', 'rose maintenance', 'care for roses'],
    displayLocations: ['faq_page', 'category'],
    isFeatured: false,
    displayOrder: 63
  },
  {
    categorySlug: 'flower-care-gifting',
    question: 'How should I care for lilies and other cut flowers?',
    answer: 'Lilies often arrive in bud or semi-bloomed form to ensure the recipient enjoys their full blooming cycle at home. As the lily blooms open, gently remove the yellow pollen stamens with a tissue to prevent petal staining and prolong bloom life.',
    keywords: ['lily care', 'care for lilies', 'cut flower care', 'pollen removal'],
    displayLocations: ['faq_page', 'category'],
    isFeatured: false,
    displayOrder: 64
  },
  {
    categorySlug: 'flower-care-gifting',
    question: 'Are flowers suitable for birthdays, anniversaries, and special occasions?',
    answer: 'Flowers have been timeless messengers of affection and celebration for centuries. Red roses express passion and romance; pink lilies symbolize prosperity and admiration; vibrant yellow carnations and gerberas convey joy and friendship.',
    keywords: ['flowers for occasions', 'birthday flowers', 'anniversary gift'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 65
  },
  {
    categorySlug: 'flower-care-gifting',
    question: 'How can I choose a bouquet for a birthday or anniversary?',
    answer: 'For romantic anniversaries, our classic Red Rose Hand-tied Bouquets or Heart-shaped arrangements are ideal. For birthdays, consider vibrant mixed flower arrangements, joyful orchids, or our signature Flower & Cake Combos.',
    keywords: ['choose bouquet', 'select flowers', 'anniversary bouquet'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 66
  },
  {
    categorySlug: 'flower-care-gifting',
    question: 'What is a suitable gift to send with flowers?',
    answer: 'Popular gift companions include gourmet Belgian chocolates, artisanal greeting cards, plush teddy bears, and freshly baked cakes. You can easily add these add-ons to your order before checkout.',
    keywords: ['gifts with flowers', 'add-ons', 'chocolates', 'teddy bear'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 67
  },
  {
    categorySlug: 'flower-care-gifting',
    question: 'How can I choose a flower-and-cake combo?',
    answer: 'Consider the recipient\'s favorite cake flavor (Chocolate, Red Velvet, or Fruit) and pair it with matching blooms. Our Red Roses & Chocolate Cake combo is an enduring favorite for couples, while Orchid & Pineapple combos are wonderful for birthdays.',
    keywords: ['flower and cake combo', 'pick combo', 'best combo'],
    displayLocations: ['faq_page', 'combos'],
    isFeatured: false,
    displayOrder: 68
  },

  // H. Account, Privacy & Support
  {
    categorySlug: 'account-privacy-support',
    question: 'How can I create an account?',
    answer: 'Click on the \'Account\' icon in the top navigation header and select \'Sign Up\'. You can register easily using your email address, phone number, or one-click Google Sign-In.',
    keywords: ['create account', 'sign up', 'register'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 69
  },
  {
    categorySlug: 'account-privacy-support',
    question: 'How can I reset my password?',
    answer: 'Click \'Login\' in the navigation header, select \'Forgot Password\', and enter your registered email address. We will send a secure password reset link to your email inbox within seconds.',
    keywords: ['reset password', 'forgot password', 'recover account'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 70
  },
  {
    categorySlug: 'account-privacy-support',
    question: 'How can I update my contact details?',
    answer: 'Once logged in, navigate to \'My Account\' > \'Profile\' or \'Addresses\'. Here you can update your phone number, default delivery addresses, and billing details.',
    keywords: ['update details', 'change profile', 'update phone number'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 71
  },
  {
    categorySlug: 'account-privacy-support',
    question: 'How is my personal information used?',
    answer: 'We take privacy seriously. Your contact information and recipient details are strictly used to fulfill your orders, send delivery updates, and provide customer support. We never sell, rent, or trade your personal information to third parties.',
    keywords: ['privacy', 'data security', 'personal information'],
    displayLocations: ['faq_page'],
    isFeatured: false,
    displayOrder: 72
  },
  {
    categorySlug: 'account-privacy-support',
    question: 'How can I contact Spring Blossoms Florist?',
    answer: 'You can reach our dedicated support team via:<br/>• <strong>Phone & WhatsApp:</strong> +91 9949683222<br/>• <strong>Email:</strong> contact@sbflorist.in<br/>• <strong>Live Store Visit:</strong> Najam Centre, Pillar No. 32, Rethi Bowli, Mehdipatnam, Hyderabad',
    keywords: ['contact florist', 'phone number', 'email address', 'customer service'],
    displayLocations: ['faq_page', 'contact', 'home'],
    isFeatured: true,
    displayOrder: 73
  },
  {
    categorySlug: 'account-privacy-support',
    question: 'Where is your store located?',
    answer: 'Our flagship floral studio and retail store is located at: <strong>Door No. 12-2-786/A & B, Najam Centre, Pillar No. 32, Rethi Bowli, Mehdipatnam, Hyderabad, Telangana 500028</strong> (Near Tolichowki & HITEC City corridor). You are welcome to visit us in person!',
    keywords: ['store address', 'store location', 'visit shop', 'where are you located'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: true,
    displayOrder: 74
  },
  {
    categorySlug: 'account-privacy-support',
    question: 'What are your business hours?',
    answer: 'Our floral studio and customer support desk operate <strong>Monday to Sunday from 09:00 AM to 11:00 PM IST</strong>. Online orders on sbflorist.in can be placed 24 hours a day, 7 days a week.',
    keywords: ['business hours', 'opening hours', 'store timings'],
    displayLocations: ['faq_page', 'contact'],
    isFeatured: true,
    displayOrder: 75
  }
];

async function seedFaqs() {
  console.log('--- Seeding FAQ Categories and Questions ---');

  // Seed Categories
  const categoryMap = {};
  for (const cat of CATEGORIES) {
    const upserted = await prisma.faqCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        displayOrder: cat.displayOrder,
        isActive: true
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        displayOrder: cat.displayOrder,
        isActive: true
      }
    });
    categoryMap[cat.slug] = upserted.id;
    console.log(`✓ Category: ${cat.name} (${upserted.id})`);
  }

  // Seed FAQs
  let inserted = 0;
  for (const faq of FAQS) {
    const categoryId = categoryMap[faq.categorySlug];
    if (!categoryId) {
      console.warn(`Category slug not found for: ${faq.categorySlug}`);
      continue;
    }

    const slug = slugify(faq.question);

    await prisma.faq.upsert({
      where: { slug },
      update: {
        question: faq.question,
        answer: faq.answer,
        categoryId,
        keywords: faq.keywords,
        displayLocations: faq.displayLocations,
        isFeatured: faq.isFeatured,
        isPublished: true,
        displayOrder: faq.displayOrder,
        seoTitle: `${faq.question} | SB Florist Hyderabad`,
        seoDescription: faq.answer.replace(/<[^>]+>/g, '').substring(0, 155)
      },
      create: {
        question: faq.question,
        answer: faq.answer,
        slug,
        categoryId,
        keywords: faq.keywords,
        displayLocations: faq.displayLocations,
        isFeatured: faq.isFeatured,
        isPublished: true,
        displayOrder: faq.displayOrder,
        seoTitle: `${faq.question} | SB Florist Hyderabad`,
        seoDescription: faq.answer.replace(/<[^>]+>/g, '').substring(0, 155)
      }
    });
    inserted++;
  }

  console.log(`\n✅ Successfully seeded ${CATEGORIES.length} categories and ${inserted} FAQs!`);
}

seedFaqs()
  .catch((err) => {
    console.error('Error seeding FAQs:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
