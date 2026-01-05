# Convert all text files to UTF-8 encoding
# For .bat and .ps1 files: UTF-8 with BOM
# For .md and .txt files: UTF-8 without BOM

Write-Host "Starting encoding conversion to UTF-8..." -ForegroundColor Green
Write-Host ""

$converted = 0
$errors = 0

# Function to convert file encoding
function Convert-FileToUTF8 {
    param (
        [string]$FilePath,
        [bool]$WithBOM = $false
    )
    
    try {
        # Read file content (detect encoding automatically)
        $content = Get-Content -Path $FilePath -Raw -Encoding Default
        
        # Write with specified encoding
        if ($WithBOM) {
            # UTF-8 with BOM
            $utf8Encoding = New-Object System.Text.UTF8Encoding $true
        } else {
            # UTF-8 without BOM
            $utf8Encoding = New-Object System.Text.UTF8Encoding $false
        }
        
        [System.IO.File]::WriteAllText($FilePath, $content, $utf8Encoding)
        return $true
    } catch {
        Write-Host "Error converting $FilePath : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Get all .bat files
$batFiles = Get-ChildItem -Path "." -Filter "*.bat" -File
Write-Host "Converting .bat files (UTF-8 with BOM)..." -ForegroundColor Cyan
foreach ($file in $batFiles) {
    if (Convert-FileToUTF8 -FilePath $file.FullName -WithBOM $true) {
        Write-Host "[OK] $($file.Name)" -ForegroundColor Green
        $converted++
    } else {
        $errors++
    }
}

# Get all .ps1 files
$ps1Files = Get-ChildItem -Path "." -Filter "*.ps1" -File
Write-Host ""
Write-Host "Converting .ps1 files (UTF-8 with BOM)..." -ForegroundColor Cyan
foreach ($file in $ps1Files) {
    if ($file.Name -ne "convert_to_utf8.ps1") {
        if (Convert-FileToUTF8 -FilePath $file.FullName -WithBOM $true) {
            Write-Host "[OK] $($file.Name)" -ForegroundColor Green
            $converted++
        } else {
            $errors++
        }
    }
}

# Get all .md files (excluding node_modules)
$mdFiles = Get-ChildItem -Path "." -Filter "*.md" -File | Where-Object { $_.FullName -notlike "*node_modules*" }
Write-Host ""
Write-Host "Converting .md files (UTF-8 without BOM)..." -ForegroundColor Cyan
foreach ($file in $mdFiles) {
    if (Convert-FileToUTF8 -FilePath $file.FullName -WithBOM $false) {
        Write-Host "[OK] $($file.Name)" -ForegroundColor Green
        $converted++
    } else {
        $errors++
    }
}

# Get all .txt files (excluding node_modules)
$txtFiles = Get-ChildItem -Path "." -Filter "*.txt" -File | Where-Object { $_.FullName -notlike "*node_modules*" }
Write-Host ""
Write-Host "Converting .txt files (UTF-8 without BOM)..." -ForegroundColor Cyan
foreach ($file in $txtFiles) {
    if (Convert-FileToUTF8 -FilePath $file.FullName -WithBOM $false) {
        Write-Host "[OK] $($file.Name)" -ForegroundColor Green
        $converted++
    } else {
        $errors++
    }
}

Write-Host ""
Write-Host "Conversion complete!" -ForegroundColor Green
Write-Host "Success: $converted files" -ForegroundColor Green
if ($errors -gt 0) {
    Write-Host "Errors: $errors files" -ForegroundColor Red
}
