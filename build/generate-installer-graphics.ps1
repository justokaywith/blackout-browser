Add-Type -AssemblyName System.Drawing

function Create-InstallerSidebar {
    param([string]$outputPath)

    $width = 164
    $height = 314
    $bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # 1. Dark obsidian background gradient
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(0, $height)),
        [System.Drawing.Color]::FromArgb(6, 7, 13),
        [System.Drawing.Color]::FromArgb(14, 15, 26)
    )
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)
    $bgBrush.Dispose()

    # 2. Subtle cosmic ambient glow
    $glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(35, 154, 122, 255))
    $g.FillEllipse($glowBrush, -40, 60, 240, 160)
    $glowBrush.Dispose()

    # 3. Ambient star particles
    $starBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(160, 200, 195, 245))
    $rand = New-Object System.Random(42)
    for ($i = 0; $i -lt 35; $i++) {
        $sx = $rand.Next(10, $width - 10)
        $sy = $rand.Next(15, $height - 15)
        $sr = $rand.Next(1, 3)
        $g.FillEllipse($starBrush, $sx, $sy, $sr, $sr)
    }
    $starBrush.Dispose()

    # 4. Atomic orbital rings around center (82, 140)
    $cx = 82
    $cy = 138

    # Orbit 1 (tilted 32 deg)
    $state1 = $g.Save()
    $g.TranslateTransform($cx, $cy)
    $g.RotateTransform(-32)
    $penPurple = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(190, 154, 122, 255), 2.0)
    $g.DrawEllipse($penPurple, -70, -22, 140, 44)
    $penPurple.Dispose()
    # Electron on Orbit 1
    $elecPurple = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 175, 145, 255))
    $g.FillEllipse($elecPurple, 48, -17, 10, 10)
    $elecPurple.Dispose()
    $g.Restore($state1)

    # Orbit 2 (tilted -32 deg)
    $state2 = $g.Save()
    $g.TranslateTransform($cx, $cy)
    $g.RotateTransform(32)
    $penOrange = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(190, 255, 104, 77), 2.0)
    $g.DrawEllipse($penOrange, -70, -22, 140, 44)
    $penOrange.Dispose()
    # Electron on Orbit 2
    $elecOrange = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 140, 100))
    $g.FillEllipse($elecOrange, -52, 12, 10, 10)
    $elecOrange.Dispose()
    $g.Restore($state2)

    # Central Nucleus
    $nucOuter = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 154, 122, 255))
    $g.FillEllipse($nucOuter, $cx - 24, $cy - 24, 48, 48)
    $nucOuter.Dispose()

    $nucBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(35, 30, 50))
    $g.FillEllipse($nucBrush, ($cx - 16), ($cy - 16), 32, 32)
    $nucBrush.Dispose()

    $nucPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 154, 122, 255), 1.5)
    $g.DrawEllipse($nucPen, $cx - 16, $cy - 16, 32, 32)
    $nucPen.Dispose()

    # 5. Typography Lines
    $fontTitle = New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Bold)
    $fontSub = New-Object System.Drawing.Font("Arial", 7, [System.Drawing.FontStyle]::Bold)
    $fontFoot = New-Object System.Drawing.Font("Arial", 7, [System.Drawing.FontStyle]::Regular)

    $formatCenter = New-Object System.Drawing.StringFormat
    $formatCenter.Alignment = [System.Drawing.StringAlignment]::Center

    # Top brand badge
    $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(119, 228, 196))
    $g.DrawString("SYS.02 // CORE", $fontSub, $badgeBrush, [float]($width / 2), 24, $formatCenter)
    $badgeBrush.Dispose()

    # Bottom title and slogan
    $textWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.DrawString("BLACKOUT", $fontTitle, $textWhite, [float]($width / 2), 220, $formatCenter)
    $g.DrawString("BROWSER", $fontTitle, $textWhite, [float]($width / 2), 238, $formatCenter)
    $textWhite.Dispose()

    $purpleText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(154, 122, 255))
    $g.DrawString("SOVEREIGN RUNTIME", $fontSub, $purpleText, [float]($width / 2), 262, $formatCenter)
    $purpleText.Dispose()

    $mutedText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 138, 155))
    $g.DrawString("v0.2.0 · Windows x64", $fontFoot, $mutedText, [float]($width / 2), 284, $formatCenter)
    $mutedText.Dispose()

    $fontTitle.Dispose()
    $fontSub.Dispose()
    $fontFoot.Dispose()
    $formatCenter.Dispose()
    $g.Dispose()

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    Write-Host "Created $outputPath ($width x $height)"
}

function Create-InstallerHeader {
    param([string]$outputPath)

    $width = 150
    $height = 57
    $bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($width, 0)),
        [System.Drawing.Color]::FromArgb(10, 11, 18),
        [System.Drawing.Color]::FromArgb(18, 19, 32)
    )
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)
    $bgBrush.Dispose()

    # Mini Atom on the right
    $cx = 118
    $cy = 28

    $state1 = $g.Save()
    $g.TranslateTransform($cx, $cy)
    $g.RotateTransform(-30)
    $penPurple = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 154, 122, 255), 1.5)
    $g.DrawEllipse($penPurple, -24, -8, 48, 16)
    $penPurple.Dispose()
    $g.Restore($state1)

    $state2 = $g.Save()
    $g.TranslateTransform($cx, $cy)
    $g.RotateTransform(30)
    $penOrange = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 255, 104, 77), 1.5)
    $g.DrawEllipse($penOrange, -24, -8, 48, 16)
    $penOrange.Dispose()
    $g.Restore($state2)

    $nuc = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 154, 122, 255))
    $g.FillEllipse($nuc, $cx - 5, $cy - 5, 10, 10)
    $nuc.Dispose()

    # Text on left
    $fontHead = New-Object System.Drawing.Font("Arial", 8.5, [System.Drawing.FontStyle]::Bold)
    $fontSub = New-Object System.Drawing.Font("Arial", 6.5, [System.Drawing.FontStyle]::Regular)

    $textWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.DrawString("BLACKOUT", $fontHead, $textWhite, 12, 14)
    $textWhite.Dispose()

    $mintText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(119, 228, 196))
    $g.DrawString("SETUP v0.2.0", $fontSub, $mintText, 12, 31)
    $mintText.Dispose()

    $fontHead.Dispose()
    $fontSub.Dispose()
    $g.Dispose()

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    Write-Host "Created $outputPath ($width x $height)"
}

function Create-AppIcon {
    param([string]$outputPath)

    $size = 256
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Transparent background
    $g.Clear([System.Drawing.Color]::Transparent)

    # Dark rounded plate
    $plateBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 9, 10, 17))
    $g.FillEllipse($plateBrush, 12, 12, 232, 232)
    $plateBrush.Dispose()

    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 154, 122, 255), 3.0)
    $g.DrawEllipse($borderPen, 12, 12, 232, 232)
    $borderPen.Dispose()

    # Center coordinates
    $cx = 128
    $cy = 128

    # Outer ambient glow
    $glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(50, 154, 122, 255))
    $g.FillEllipse($glow, $cx - 65, $cy - 65, 130, 130)
    $glow.Dispose()

    # Orbit 1 (purple)
    $s1 = $g.Save()
    $g.TranslateTransform($cx, $cy)
    $g.RotateTransform(-32)
    $pen1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(240, 154, 122, 255), 4.0)
    $g.DrawEllipse($pen1, -95, -28, 190, 56)
    $pen1.Dispose()
    # Electron 1
    $e1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255))
    $g.FillEllipse($e1, 65, -22, 16, 16)
    $e1.Dispose()
    $g.Restore($s1)

    # Orbit 2 (orange)
    $s2 = $g.Save()
    $g.TranslateTransform($cx, $cy)
    $g.RotateTransform(32)
    $pen2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(240, 255, 104, 77), 4.0)
    $g.DrawEllipse($pen2, -95, -28, 190, 56)
    $pen2.Dispose()
    # Electron 2
    $e2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 220, 180))
    $g.FillEllipse($e2, -70, 16, 16, 16)
    $e2.Dispose()
    $g.Restore($s2)

    $nucBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(35, 30, 50))
    $g.FillEllipse($nucBrush, ($cx - 28), ($cy - 28), 56, 56)
    $nucBrush.Dispose()

    $nucBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 154, 122, 255), 2.5)
    $g.DrawEllipse($nucBorder, $cx - 28, $cy - 28, 56, 56)
    $nucBorder.Dispose()

    $g.Dispose()

    # Save as ICO via HIcon
    $hIcon = $bmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $fileStream = New-Object System.IO.FileStream($outputPath, [System.IO.FileMode]::Create)
    $icon.Save($fileStream)
    $fileStream.Close()
    $icon.Dispose()
    $bmp.Dispose()
    Write-Host "Created $outputPath (256x256 ICO)"
}

$buildDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Create-InstallerSidebar (Join-Path $buildDir "installerSidebar.bmp")
Create-InstallerHeader (Join-Path $buildDir "installerHeader.bmp")
Create-AppIcon (Join-Path $buildDir "icon.ico")
Write-Host "All Blackout installer artwork generated successfully!"
