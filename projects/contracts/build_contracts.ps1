# Build script for AlgoKit contracts
Write-Host "Building Ticketing Contract..." -ForegroundColor Green
poetry run algokit compile smart_contracts/ticketing/contract.py

Write-Host "`nBuilding Fundraiser Contract..." -ForegroundColor Green
poetry run algokit compile smart_contracts/fundraiser/contract.py

Write-Host "`nBuild complete!" -ForegroundColor Green
