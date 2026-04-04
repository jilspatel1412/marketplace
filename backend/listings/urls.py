from django.urls import path
from . import views

urlpatterns = [
    path('', views.listing_list_create, name='listing_list_create'),
    path('batch/', views.batch_listings, name='batch_listings'),
    path('categories/', views.category_list, name='category_list'),
    path('my/', views.seller_listings, name='seller_listings'),
    path('my/offers/', views.seller_offers, name='seller_offers'),
    path('favorites/', views.my_favorites, name='my_favorites'),
    path('<int:pk>/', views.listing_detail, name='listing_detail'),
    path('<int:pk>/images/', views.upload_listing_image, name='upload_listing_image'),
    path('<int:pk>/related/', views.related_listings, name='related_listings'),
    path('<int:pk>/offers/', views.offer_list_create, name='offer_list_create'),
    path('<int:pk>/bids/', views.bid_list_create, name='bid_list_create'),
    path('<int:pk>/contact/', views.contact_seller, name='contact_seller'),
    path('<int:pk>/view/', views.log_view, name='log_view'),
    path('<int:pk>/favorite/', views.toggle_favorite, name='toggle_favorite'),
    path('<int:pk>/buy/', views.buy_now, name='buy_now'),
    path('<int:pk>/accept-bid/', views.accept_auction_bid, name='accept_auction_bid'),
    path('<int:pk>/images/<int:image_id>/', views.delete_listing_image, name='delete_listing_image'),
    path('offers/<int:offer_id>/', views.offer_update, name='offer_update'),
    path('<int:pk>/report/', views.report_listing, name='report_listing'),
    path('search-alerts/', views.search_alert_list_create, name='search_alert_list_create'),
    path('search-alerts/<int:alert_id>/', views.search_alert_detail, name='search_alert_detail'),
    path('admin/reports/', views.admin_reports, name='admin_reports'),
    path('admin/reports/<int:report_id>/', views.admin_delete_report, name='admin_delete_report'),
]
