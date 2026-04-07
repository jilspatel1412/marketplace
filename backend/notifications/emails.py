"""
Professional HTML email templates for SellIt.

Usage:
    from notifications.emails import render_email
    html = render_email('order_confirmed', username='John', amount='49.99', ...)
"""


def _base(content, preheader=''):
    """Base email layout with SellIt branding."""
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>SellIt</title>
<!--[if mso]><style>table,td{{font-family:Arial,sans-serif}}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
<span style="display:none;font-size:1px;color:#f4f4f7;max-height:0;overflow:hidden">{preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7">
<tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#e03d00 0%,#ff5a1f 100%);padding:28px 32px;text-align:center">
<span style="color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;text-decoration:none">SellIt</span>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:36px 32px 20px">
{content}
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:0 32px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="border-top:1px solid #eaeaea;padding-top:20px">
<p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;text-align:center">
You received this email because you have an account on SellIt.<br>
If you didn't expect this, you can safely ignore it.
</p>
<p style="margin:12px 0 0;font-size:12px;color:#d1d5db;text-align:center">
&copy; 2026 SellIt. All rights reserved.
</p>
</td></tr>
</table>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>'''


def _heading(text):
    return f'<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">{text}</h1>'


def _subtext(text):
    return f'<p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.5">{text}</p>'


def _paragraph(text):
    return f'<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">{text}</p>'


def _button(text, url, color='#e03d00'):
    return f'''<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto">
<tr><td align="center" style="background:{color};border-radius:8px">
<a href="{url}" target="_blank" style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px">{text}</a>
</td></tr>
</table>'''


def _info_row(label, value):
    return f'''<tr>
<td style="padding:10px 16px;font-size:13px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f3f4f6;width:140px">{label}</td>
<td style="padding:10px 16px;font-size:15px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6">{value}</td>
</tr>'''


def _info_table(rows):
    """rows = list of (label, value) tuples"""
    inner = ''.join(_info_row(l, v) for l, v in rows)
    return f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;overflow:hidden;margin:0 0 24px">
{inner}
</table>'''


def _badge(text, bg='#fef3c7', color='#92400e'):
    return f'<span style="display:inline-block;padding:4px 12px;font-size:12px;font-weight:700;color:{color};background:{bg};border-radius:20px;text-transform:uppercase;letter-spacing:0.5px">{text}</span>'


def _link(text, url):
    return f'<a href="{url}" style="color:#e03d00;text-decoration:underline;font-weight:500">{text}</a>'


def _note(text):
    return f'<p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.5">{text}</p>'


# ─── Template Functions ──────────────────────────────────────────────────────

def verify_email(username, verify_url):
    return _base(
        _heading('Verify your email address') +
        _subtext(f'Hi {username},') +
        _paragraph('Thanks for creating a SellIt account! Click the button below to verify your email address and get started.') +
        _button('Verify Email Address', verify_url) +
        _note(f'Or copy and paste this link into your browser:') +
        _note(f'<a href="{verify_url}" style="color:#e03d00;word-break:break-all;font-size:12px">{verify_url}</a>'),
        preheader='Verify your email to activate your SellIt account'
    )


def password_reset(username, reset_url):
    return _base(
        _heading('Reset your password') +
        _subtext(f'Hi {username},') +
        _paragraph('We received a request to reset your password. Click the button below to choose a new one.') +
        _button('Reset Password', reset_url) +
        _paragraph('<strong style="color:#111827">This link expires in 24 hours.</strong> If you didn\'t request this, you can safely ignore this email — your password won\'t be changed.') +
        _note(f'Or copy and paste this link: <a href="{reset_url}" style="color:#e03d00;word-break:break-all;font-size:12px">{reset_url}</a>'),
        preheader='Reset your SellIt password'
    )


def order_confirmed_buyer(username, item_title, amount, order_id, frontend_url):
    return _base(
        _heading('Order Confirmed') +
        _subtext(f'Hi {username},') +
        _paragraph('Great news! Your payment was successful and your order has been placed.') +
        _info_table([
            ('Item', item_title),
            ('Amount', f'<span style="color:#e03d00;font-weight:800">${amount} CAD</span>'),
            ('Order', f'#{order_id}'),
            ('Status', _badge('Paid', '#d1fae5', '#065f46')),
        ]) +
        _paragraph('Your payment is held securely in escrow until you confirm delivery. You have <strong>7 days</strong> after delivery to open a dispute if anything is wrong.') +
        _button('View Order', f'{frontend_url}/orders/{order_id}'),
        preheader=f'Payment confirmed for "{item_title}"'
    )


def order_confirmed_seller(username, buyer_username, item_title, amount, order_id, buyer_address, frontend_url):
    return _base(
        _heading('You made a sale!') +
        _subtext(f'Hi {username},') +
        _paragraph(f'<strong>{buyer_username}</strong> just purchased your listing. Time to ship it!') +
        _info_table([
            ('Item', item_title),
            ('Amount', f'<span style="color:#e03d00;font-weight:800">${amount} CAD</span>'),
            ('Order', f'#{order_id}'),
            ('Ship To', buyer_address),
        ]) +
        _button('View Order & Print Label', f'{frontend_url}/seller/orders') +
        _paragraph('Once you ship the item, mark it as shipped in your dashboard and add the tracking number.'),
        preheader=f'New sale — {buyer_username} bought "{item_title}"'
    )


def order_shipped(username, item_title, tracking_number, frontend_url, order_id):
    tracking_html = ''
    if tracking_number:
        tracking_html = _info_table([
            ('Item', item_title),
            ('Tracking', f'<span style="font-family:monospace;font-size:14px;color:#111827">{tracking_number}</span>'),
        ])
    else:
        tracking_html = _info_table([
            ('Item', item_title),
            ('Tracking', '<span style="color:#9ca3af">Not provided</span>'),
        ])

    return _base(
        _heading('Your order has shipped!') +
        _subtext(f'Hi {username},') +
        _paragraph('Your item is on the way. Once it arrives, please confirm delivery in your orders page.') +
        tracking_html +
        _button('Track Order', f'{frontend_url}/orders/{order_id}') +
        _paragraph('After confirming delivery, you\'ll have <strong>7 days</strong> of buyer protection to open a dispute if needed.'),
        preheader=f'Your order for "{item_title}" has shipped'
    )


def new_offer(seller_username, buyer_username, item_title, offer_price, frontend_url):
    return _base(
        _heading('New offer received') +
        _subtext(f'Hi {seller_username},') +
        _paragraph(f'<strong>{buyer_username}</strong> has submitted an offer on your listing.') +
        _info_table([
            ('Listing', item_title),
            ('Offer', f'<span style="color:#e03d00;font-weight:800">${offer_price} CAD</span>'),
            ('From', buyer_username),
        ]) +
        _button('Review Offer', f'{frontend_url}/seller/offers'),
        preheader=f'{buyer_username} offered ${offer_price} on "{item_title}"'
    )


def offer_accepted(buyer_username, item_title, offer_price, frontend_url):
    return _base(
        _heading('Your offer was accepted!') +
        _subtext(f'Hi {buyer_username},') +
        _paragraph(f'Great news — the seller accepted your offer on <strong>{item_title}</strong>.') +
        _info_table([
            ('Item', item_title),
            ('Your Offer', f'<span style="color:#e03d00;font-weight:800">${offer_price} CAD</span>'),
            ('Status', _badge('Accepted', '#d1fae5', '#065f46')),
        ]) +
        _button('Complete Payment', f'{frontend_url}/buyer/orders') +
        _paragraph('Please complete your payment soon to secure the item.'),
        preheader=f'Your offer of ${offer_price} on "{item_title}" was accepted'
    )


def offer_rejected(buyer_username, item_title, offer_price, listing_id, frontend_url):
    return _base(
        _heading('Your offer was declined') +
        _subtext(f'Hi {buyer_username},') +
        _paragraph(f'Unfortunately, the seller declined your offer on <strong>{item_title}</strong>.') +
        _info_table([
            ('Item', item_title),
            ('Your Offer', f'${offer_price} CAD'),
            ('Status', _badge('Declined', '#fee2e2', '#991b1b')),
        ]) +
        _paragraph('Don\'t give up — you can submit a new offer or browse other listings.') +
        _button('View Listing', f'{frontend_url}/listings/{listing_id}'),
        preheader=f'Your offer on "{item_title}" was declined'
    )


def auction_won(winner_username, item_title, bid_amount, frontend_url):
    return _base(
        _heading('Congratulations — you won!') +
        _subtext(f'Hi {winner_username},') +
        _paragraph(f'You won the auction for <strong>{item_title}</strong>! Complete your payment to secure the item.') +
        _info_table([
            ('Item', item_title),
            ('Winning Bid', f'<span style="color:#e03d00;font-weight:800">${bid_amount} CAD</span>'),
            ('Status', _badge('Won', '#d1fae5', '#065f46')),
        ]) +
        _button('Pay Now', f'{frontend_url}/buyer/orders'),
        preheader=f'You won the auction for "{item_title}" at ${bid_amount}'
    )


def auction_ended_seller(seller_username, item_title, winner_username, bid_amount, frontend_url):
    return _base(
        _heading('Your auction has ended') +
        _subtext(f'Hi {seller_username},') +
        _paragraph(f'Your auction for <strong>{item_title}</strong> has closed with a winning bid.') +
        _info_table([
            ('Item', item_title),
            ('Winner', winner_username),
            ('Winning Bid', f'<span style="color:#e03d00;font-weight:800">${bid_amount} CAD</span>'),
        ]) +
        _button('View Orders', f'{frontend_url}/seller/orders') +
        _paragraph(f'Once {winner_username} completes payment, you\'ll be notified to ship the item.'),
        preheader=f'Auction ended — {winner_username} won "{item_title}" at ${bid_amount}'
    )


def listing_inquiry(seller_username, buyer_username, item_title, message_text, frontend_url):
    return _base(
        _heading('New message about your listing') +
        _subtext(f'Hi {seller_username},') +
        _paragraph(f'<strong>{buyer_username}</strong> sent you a message about <strong>{item_title}</strong>:') +
        f'<div style="background:#f9fafb;border-left:4px solid #e03d00;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px">'
        f'<p style="margin:0;font-size:15px;color:#374151;line-height:1.6;font-style:italic">"{message_text}"</p>'
        f'</div>' +
        _button('Reply in Inbox', f'{frontend_url}/inbox') +
        _note(f'Sent by {buyer_username}'),
        preheader=f'{buyer_username}: "{message_text[:60]}..."'
    )
