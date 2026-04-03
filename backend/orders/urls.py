from django.urls import path
from . import views

urlpatterns = [
    path('', views.order_list, name='order_list'),
    path('<int:order_id>/', views.order_detail, name='order_detail'),
    path('<int:order_id>/shipping-label/', views.shipping_label, name='shipping_label'),
    path('<int:order_id>/status/', views.update_order_status, name='update_order_status'),
    path('<int:order_id>/review/', views.create_review, name='create_review'),
    path('seller/<int:seller_id>/reviews/', views.seller_reviews, name='seller_reviews'),
    path('disputes/', views.dispute_list_create, name='dispute_list_create'),
    path('disputes/<int:dispute_id>/', views.dispute_detail, name='dispute_detail'),
    path('admin/stats/', views.admin_stats, name='admin_stats'),
]
