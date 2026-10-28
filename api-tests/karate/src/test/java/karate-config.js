function fn() {
  var System = Java.type('java.lang.System')
  var baseUrl = karate.properties.baseUrl || System.getenv('BASE_URL') || 'http://127.0.0.1:4173'

  return { baseUrl: baseUrl }
}
