param(
  [ValidateSet('TRUTH', 'LIE')][string]$Verdict,
  [int]$DurationMs = 1800,
  [string]$Popup = 'True',
  [string]$Sound = 'True',
  [string]$ImagePath,
  [string]$SoundPath
)

if ($Sound -eq 'True' -and $SoundPath -and (Test-Path -LiteralPath $SoundPath)) {
  try { (New-Object System.Media.SoundPlayer $SoundPath).Play() } catch {}
}

if ($Popup -ne 'True') { exit 0 }

Add-Type -AssemblyName PresentationFramework
$window = New-Object Windows.Window
$window.Title = "Lie Detector: $Verdict"
$window.Width = 640
$window.Height = 420
$window.WindowStartupLocation = 'CenterScreen'
$window.Topmost = $true
$window.ResizeMode = 'NoResize'
$window.WindowStyle = 'ToolWindow'
$window.Background = if ($Verdict -eq 'TRUTH') { '#123D24' } else { '#521919' }

if ($ImagePath -and (Test-Path -LiteralPath $ImagePath)) {
  try {
    $image = New-Object Windows.Controls.Image
    $image.Source = New-Object Windows.Media.Imaging.BitmapImage ([Uri]$ImagePath)
    $image.Stretch = 'Uniform'
    $window.Content = $image
  } catch {}
}

if (-not $window.Content) {
  $text = New-Object Windows.Controls.TextBlock
  $text.Text = $Verdict
  $text.Foreground = 'White'
  $text.FontSize = 88
  $text.FontWeight = 'Bold'
  $text.HorizontalAlignment = 'Center'
  $text.VerticalAlignment = 'Center'
  $window.Content = $text
}

$window.Add_MouseLeftButtonDown({ $window.Close() })
$window.Add_KeyDown({ if ($_.Key -eq 'Escape') { $window.Close() } })
$timer = New-Object Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds($DurationMs)
$timer.Add_Tick({ $timer.Stop(); $window.Close() })
$timer.Start()
$window.ShowDialog() | Out-Null
