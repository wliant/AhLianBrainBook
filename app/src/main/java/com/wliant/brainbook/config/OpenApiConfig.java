package com.wliant.brainbook.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI brainBookOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("BrainBook API")
                        .description("REST API for BrainBook — a personal technical notebook for structured knowledge management.")
                        .version("0.1.0"));
    }
}
