#!/usr/bin/env python3
"""
Fetch DMI API documentation using Selenium WebDriver
Requires: pip install selenium webdriver-manager
"""

import json
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def fetch_swagger_spec():
    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Run in background
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    # Setup driver
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        # Load the Swagger UI page
        print("Loading Swagger UI page...")
        driver.get("https://dmigw.govcloud.dk/v2/metObs/swagger-ui/index.html")
        
        # Wait for Swagger UI to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, "swagger-ui"))
        )
        
        # Give it a moment to fully load the spec
        time.sleep(3)
        
        # Try to extract the spec from JavaScript
        print("Extracting API specification...")
        spec = driver.execute_script("""
            // Try different ways to get the spec
            if (window.ui && window.ui.specSelectors && window.ui.specSelectors.specJson) {
                return window.ui.specSelectors.specJson();
            } else if (window.ui && window.ui.spec) {
                return window.ui.spec();
            } else if (window.swaggerSpec) {
                return window.swaggerSpec;
            } else {
                // Try to find it in the Redux store
                const state = window.ui && window.ui.getState && window.ui.getState();
                if (state && state.spec && state.spec.json) {
                    return state.spec.json;
                }
            }
            return null;
        """)
        
        if spec:
            print("Successfully extracted API specification!")
            with open("dmi_api_selenium.json", "w") as f:
                json.dump(spec, f, indent=2)
            print("Saved to: dmi_api_selenium.json")
        else:
            print("Could not extract specification from JavaScript")
            
            # Try to get the spec URL
            spec_url = driver.execute_script("""
                const config = window.ui && window.ui.getConfigs && window.ui.getConfigs();
                return config && config.url;
            """)
            
            if spec_url:
                print(f"Found spec URL: {spec_url}")
                
    finally:
        driver.quit()

if __name__ == "__main__":
    fetch_swagger_spec()
