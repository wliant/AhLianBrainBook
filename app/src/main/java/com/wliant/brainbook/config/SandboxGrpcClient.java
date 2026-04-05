package com.wliant.brainbook.config;

import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.sandbox.grpc.*;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class SandboxGrpcClient {

    private static final Logger log = LoggerFactory.getLogger(SandboxGrpcClient.class);

    private final ManagedChannel channel;
    private final SandboxServiceGrpc.SandboxServiceBlockingStub stub;

    public SandboxGrpcClient(@Value("${SANDBOX_SERVICE_HOST:localhost:50051}") String host) {
        log.info("Connecting to sandbox service at {}", host);
        this.channel = ManagedChannelBuilder.forTarget(host)
                .usePlaintext()
                .keepAliveTime(30, TimeUnit.SECONDS)
                .keepAliveTimeout(5, TimeUnit.SECONDS)
                .build();
        this.stub = SandboxServiceGrpc.newBlockingStub(channel);
    }

    @PreDestroy
    public void shutdown() {
        try {
            channel.shutdown().awaitTermination(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            channel.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    public SandboxInfo provision(UUID clusterId, UUID brainId, String repoUrl, String branch, boolean shallow) {
        try {
            return stub.provision(ProvisionRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .setBrainId(brainId.toString())
                    .setRepoUrl(repoUrl)
                    .setBranch(branch != null ? branch : "")
                    .setShallow(shallow)
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public SandboxInfo getStatus(UUID clusterId) {
        try {
            return stub.getStatus(GetStatusRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public void terminate(UUID clusterId) {
        try {
            stub.terminate(TerminateRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public int terminateByBrain(UUID brainId) {
        try {
            TerminateByBrainResponse resp = stub.terminateByBrain(TerminateByBrainRequest.newBuilder()
                    .setBrainId(brainId.toString())
                    .build());
            return resp.getTerminatedCount();
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public SandboxInfo retry(UUID clusterId) {
        try {
            return stub.retry(RetryRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public ListActiveResponse listActive() {
        try {
            return stub.listActive(ListActiveRequest.newBuilder().build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public PullResponse pull(UUID clusterId) {
        try {
            return stub.pull(com.wliant.brainbook.sandbox.grpc.PullRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public SandboxInfo checkout(UUID clusterId, String branch) {
        try {
            return stub.checkout(com.wliant.brainbook.sandbox.grpc.CheckoutRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .setBranch(branch)
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public ListBranchesResponse listBranches(UUID clusterId) {
        try {
            return stub.listBranches(ListBranchesRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public GetFileTreeResponse getFileTree(UUID clusterId, String path) {
        try {
            return stub.getFileTree(GetFileTreeRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .setPath(path != null ? path : "")
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public GetFileContentResponse getFileContent(UUID clusterId, String path) {
        try {
            return stub.getFileContent(GetFileContentRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .setPath(path)
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public GetLogResponse getLog(UUID clusterId, int limit, int offset) {
        try {
            return stub.getLog(GetLogRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .setLimit(limit)
                    .setOffset(offset)
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public GetBlameResponse getBlame(UUID clusterId, String path) {
        try {
            return stub.getBlame(GetBlameRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .setPath(path)
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public GetDiffResponse getDiff(UUID clusterId, String fromRef, String toRef) {
        try {
            return stub.getDiff(GetDiffRequest.newBuilder()
                    .setClusterId(clusterId.toString())
                    .setFromRef(fromRef)
                    .setToRef(toRef)
                    .build());
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    public String detectDefaultBranch(String repoUrl) {
        try {
            DetectDefaultBranchResponse resp = stub.detectDefaultBranch(
                    DetectDefaultBranchRequest.newBuilder()
                            .setRepoUrl(repoUrl)
                            .build());
            return resp.getBranch();
        } catch (StatusRuntimeException e) {
            throw mapException(e);
        }
    }

    private RuntimeException mapException(StatusRuntimeException e) {
        String msg = e.getStatus().getDescription();
        if (msg == null) msg = e.getMessage();

        return switch (e.getStatus().getCode()) {
            case NOT_FOUND -> new ResourceNotFoundException(msg);
            case ALREADY_EXISTS, FAILED_PRECONDITION, RESOURCE_EXHAUSTED -> new ConflictException(msg);
            case INVALID_ARGUMENT -> new IllegalArgumentException(msg);
            case PERMISSION_DENIED -> new SecurityException(msg);
            case UNAVAILABLE -> {
                log.warn("Sandbox service unavailable: {}", msg);
                yield new RuntimeException("Sandbox service is temporarily unavailable", e);
            }
            default -> new RuntimeException("Sandbox service error: " + msg, e);
        };
    }
}
