package api;

import com.intuit.karate.junit5.Karate;

class DemoShopApiTest {

    @Karate.Test
    Karate demoShopApi() {
        return Karate.run("demo-shop").relativeTo(getClass());
    }
}
