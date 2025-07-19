#!/usr/bin/env python3
"""
DMI Open Data API - Python Examples
Documentation and usage examples
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
API_KEY = "78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL = "https://dmigw.govcloud.dk/v2/metObs"

# Headers for all requests
headers = {
    "X-Gravitee-Api-Key": API_KEY,
    "Accept": "application/json"
}

def get_api_docs():
    """Get the OpenAPI specification"""
    response = requests.get(f"{BASE_URL}/api", headers=headers)
    if response.ok:
        with open("dmi_openapi.json", "w") as f:
            json.dump(response.json(), f, indent=2)
        print("OpenAPI spec saved to dmi_openapi.json")
    return response.json()

def get_collections():
    """Get available collections"""
    response = requests.get(f"{BASE_URL}/collections", headers=headers)
    return response.json()

def get_conformance():
    """Get API conformance information"""
    response = requests.get(f"{BASE_URL}/conformance", headers=headers)
    return response.json()

def get_stations(limit=10, bbox=None):
    """Get meteorological stations"""
    params = {"limit": limit}
    if bbox:
        params["bbox"] = bbox
    response = requests.get(f"{BASE_URL}/collections/station/items", 
                          headers=headers, params=params)
    return response.json()

def get_observations(parameter_id=None, station_id=None, datetime_range=None, limit=10):
    """Get observations with various filters"""
    params = {"limit": limit}
    if parameter_id:
        params["parameterId"] = parameter_id
    if station_id:
        params["stationId"] = station_id
    if datetime_range:
        params["datetime"] = datetime_range
    
    response = requests.get(f"{BASE_URL}/collections/observation/items", 
                          headers=headers, params=params)
    return response.json()

def print_api_structure():
    """Print a summary of the API structure"""
    print("DMI Open Data API Structure")
    print("=" * 50)
    
    # Get collections
    collections = get_collections()
    print("\nAvailable Collections:")
    for collection in collections.get("collections", []):
        print(f"- {collection['id']}: {collection.get('title', 'N/A')}")
        print(f"  Description: {collection.get('description', 'N/A')}")
        print()
    
    # Get conformance
    conformance = get_conformance()
    print("\nAPI Conforms to:")
    for standard in conformance.get("conformsTo", []):
        print(f"- {standard}")
    
    # Get sample parameters from a station
    stations = get_stations(limit=1)
    if stations.get("features"):
        station = stations["features"][0]
        print(f"\nExample Station: {station['properties'].get('name', 'N/A')}")
        print(f"Available Parameters:")
        for param in station["properties"].get("parameterId", []):
            print(f"- {param}")

if __name__ == "__main__":
    # Save API documentation
    print("Fetching DMI API Documentation...")
    get_api_docs()
    
    # Print API structure
    print_api_structure()
    
    # Example: Generate documentation for all endpoints
    print("\n" + "=" * 50)
    print("API Endpoint Documentation")
    print("=" * 50)
    
    endpoints = [
        ("GET /", "Landing page"),
        ("GET /collections", "List collections"),
        ("GET /collections/{collectionId}", "Get collection details"),
        ("GET /collections/{collectionId}/items", "Get collection items"),
        ("GET /collections/{collectionId}/items/{featureId}", "Get single item"),
        ("GET /conformance", "API standards conformance"),
        ("GET /api", "OpenAPI specification")
    ]
    
    for endpoint, description in endpoints:
        print(f"\n{endpoint}")
        print(f"  {description}")
