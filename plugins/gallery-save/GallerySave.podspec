require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'GallerySave'
  s.version = package['version']
  s.summary = package['description']
  s.license = 'MIT'
  s.homepage = 'https://aaraapp.com'
  s.author = 'aara'
  s.source = { :git => 'https://github.com/aara-app/coloring-worlds.git', :tag => s.version.to_s }
  s.source_files = 'ios/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '13.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
