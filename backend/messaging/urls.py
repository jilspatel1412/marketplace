from django.urls import path
from . import views

urlpatterns = [
    path('', views.thread_list, name='thread_list'),
    path('unread/', views.unread_count, name='unread_count'),
    path('<int:partner_id>/', views.thread_detail, name='thread_detail'),
]
