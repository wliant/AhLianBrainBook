package com.wliant.brainbook;

import com.wliant.brainbook.config.TestContainersConfig;
import io.minio.MinioClient;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class BrainBookApplicationTests {

    @MockitoBean
    private MinioClient minioClient;

    @Test
    void contextLoads() {
    }
}
