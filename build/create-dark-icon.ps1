Add-Type -AssemblyName System.Drawing

function Create-MultiResIcon {
    param(
        [string]$icoPath
    )

    $sizes = @(256, 64, 48, 32, 16)
    $bitmaps = @()

    foreach ($size in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)

        $scale = [float]$size / 256.0

        # Draw dark obsidian squircle background
        $margin = [float][Math]::Max(1.0, 6.0 * $scale)
        $cornerRad = [float](44.0 * $scale)
        $rectW = [float]($size - 2 * $margin)
        $rectH = [float]($size - 2 * $margin)

        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = [float]($cornerRad * 2)
        $path.AddArc($margin, $margin, $d, $d, [float]180, [float]90)
        $path.AddArc([float]($margin + $rectW - $d), $margin, $d, $d, [float]270, [float]90)
        $path.AddArc([float]($margin + $rectW - $d), [float]($margin + $rectH - $d), $d, $d, [float]0, [float]90)
        $path.AddArc($margin, [float]($margin + $rectH - $d), $d, $d, [float]90, [float]90)
        $path.CloseFigure()

        # Obsidian gradient fill (deep space dark)
        $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            (New-Object System.Drawing.PointF(0, 0)),
            (New-Object System.Drawing.PointF($size, $size)),
            [System.Drawing.Color]::FromArgb(255, 14, 16, 26),
            [System.Drawing.Color]::FromArgb(255, 6, 7, 12)
        )
        $g.FillPath($bgBrush, $path)
        $bgBrush.Dispose()

        # Border
        $borderWidth = [float][Math]::Max(1.0, 3.5 * $scale)
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 154, 122, 255), $borderWidth)
        $g.DrawPath($borderPen, $path)
        $borderPen.Dispose()
        $path.Dispose()

        # Center coordinates
        $cx = [float]($size / 2.0)
        $cy = [float]($size / 2.0)

        # Ambient glow around nucleus
        if ($size -ge 32) {
            $glowRad = [float](45.0 * $scale)
            $glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(50, 154, 122, 255))
            $g.FillEllipse($glowBrush, [float]($cx - $glowRad), [float]($cy - $glowRad), [float]($glowRad * 2), [float]($glowRad * 2))
            $glowBrush.Dispose()
        }

        $ringW = [float](160.0 * $scale)
        $ringH = [float](48.0 * $scale)

        # Orbit 1: Electric Purple (Tilt -32 deg)
        $state1 = $g.Save()
        $g.TranslateTransform($cx, $cy)
        $g.RotateTransform(-32)
        $orbitPen1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(245, 154, 122, 255), [float][Math]::Max(1.2, 3.4 * $scale))
        $g.DrawEllipse($orbitPen1, [float](-$ringW / 2.0), [float](-$ringH / 2.0), [float]$ringW, [float]$ringH)
        $orbitPen1.Dispose()

        # Electron 1 (Bright Cyan/White)
        $e1Rad = [float][Math]::Max(2.0, 8.0 * $scale)
        $e1X = [float](($ringW / 2.0) * 0.72)
        $e1Y = [float](-($ringH / 2.0) * 0.70)
        $e1Brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        $g.FillEllipse($e1Brush, [float]($e1X - $e1Rad), [float]($e1Y - $e1Rad), [float]($e1Rad * 2), [float]($e1Rad * 2))
        $e1Brush.Dispose()
        $g.Restore($state1)

        # Orbit 2: Volcanic Orange (Tilt +32 deg)
        $state2 = $g.Save()
        $g.TranslateTransform($cx, $cy)
        $g.RotateTransform(32)
        $orbitPen2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(245, 255, 104, 77), [float][Math]::Max(1.2, 3.4 * $scale))
        $g.DrawEllipse($orbitPen2, [float](-$ringW / 2.0), [float](-$ringH / 2.0), [float]$ringW, [float]$ringH)
        $orbitPen2.Dispose()

        # Electron 2 (Bright Orange/Yellow)
        $e2Rad = [float][Math]::Max(2.0, 7.5 * $scale)
        $e2X = [float](-($ringW / 2.0) * 0.75)
        $e2Y = [float](($ringH / 2.0) * 0.65)
        $e2Brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 215, 175))
        $g.FillEllipse($e2Brush, [float]($e2X - $e2Rad), [float]($e2Y - $e2Rad), [float]($e2Rad * 2), [float]($e2Rad * 2))
        $e2Brush.Dispose()
        $g.Restore($state2)

        # Nucleus Core
        $nucRad = [float][Math]::Max(3.0, 16.0 * $scale)
        $nucHalo = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 154, 122, 255))
        $g.FillEllipse($nucHalo, [float]($cx - $nucRad), [float]($cy - $nucRad), [float]($nucRad * 2), [float]($nucRad * 2))
        $nucHalo.Dispose()

        $innerRad = [float][Math]::Max(1.5, 8.5 * $scale)
        $nucWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        $g.FillEllipse($nucWhite, [float]($cx - $innerRad), [float]($cy - $innerRad), [float]($innerRad * 2), [float]($innerRad * 2))
        $nucWhite.Dispose()

        $g.Dispose()
        $bitmaps += $bmp
    }

    # Assemble into multi-image ICO binary format
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)

    # ICONDIR header: Reserved (2 bytes = 0), Type (2 bytes = 1 for icon), Count (2 bytes)
    $bw.Write([uint16]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]$sizes.Length)

    $offset = 6 + (16 * $sizes.Length)
    $pngStreams = @()

    for ($i = 0; $i -lt $sizes.Length; $i++) {
        $sz = $sizes[$i]
        $b = $bitmaps[$i]

        $pngMs = New-Object System.IO.MemoryStream
        $b.Save($pngMs, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes = $pngMs.ToArray()
        $pngMs.Dispose()
        $pngStreams += ,$pngBytes

        $bByte = if ($sz -eq 256) { [byte]0 } else { [byte]$sz }

        # ICONDIRENTRY:
        $bw.Write($bByte)                      # Width
        $bw.Write($bByte)                      # Height
        $bw.Write([byte]0)                     # ColorCount
        $bw.Write([byte]0)                     # Reserved
        $bw.Write([uint16]1)                   # Planes
        $bw.Write([uint16]32)                  # BitCount
        $bw.Write([uint32]$pngBytes.Length)    # BytesInRes
        $bw.Write([uint32]$offset)             # ImageOffset

        $offset += $pngBytes.Length
    }

    foreach ($pngBytes in $pngStreams) {
        $bw.Write($pngBytes)
    }

    $bw.Flush()
    [System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
    $bw.Dispose()
    $ms.Dispose()

    foreach ($b in $bitmaps) { $b.Dispose() }
    Write-Host "Multi-resolution dark squircle icon created at $icoPath with sizes: $($sizes -join ', ')"
}

Create-MultiResIcon -icoPath "tools\blackout-browser\build\icon.ico"
