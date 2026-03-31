package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.ShareRequest;
import com.wliant.brainbook.dto.ShareResponse;
import com.wliant.brainbook.dto.SharedNeuronResponse;
import com.wliant.brainbook.service.ShareService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ShareController {

    private final ShareService shareService;

    public ShareController(ShareService shareService) {
        this.shareService = shareService;
    }

    @PostMapping("/neurons/{neuronId}/share")
    public ResponseEntity<ShareResponse> createShareLink(
            @PathVariable UUID neuronId,
            @RequestBody(required = false) ShareRequest request) {
        Integer expiresInHours = request != null ? request.expiresInHours() : null;
        ShareResponse response = shareService.createShareLink(neuronId, expiresInHours);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/shares/{token}")
    public ResponseEntity<SharedNeuronResponse> getSharedNeuron(@PathVariable String token) {
        return ResponseEntity.ok(shareService.getSharedNeuron(token));
    }

    @GetMapping("/neurons/{neuronId}/shares")
    public ResponseEntity<List<ShareResponse>> getSharesForNeuron(@PathVariable UUID neuronId) {
        return ResponseEntity.ok(shareService.getSharesForNeuron(neuronId));
    }

    @DeleteMapping("/shares/{shareId}")
    public ResponseEntity<Void> revokeShare(@PathVariable UUID shareId) {
        shareService.revokeShare(shareId);
        return ResponseEntity.noContent().build();
    }
}
