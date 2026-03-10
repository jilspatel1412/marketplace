from django.urls import path
from . import views

urlpatterns = [
    path('search-trends/', views.search_trends, name='search_trends'),
    path('revenue/', views.revenue, name='revenue'),
]
