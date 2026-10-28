package com.pichincha.mbbk.document.docs;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

final class MultipartJobs {

    private MultipartJobs() {
    }

    static List<String> save(Path dir, List<MultipartFile> files) throws IOException {
        List<String> paths = new ArrayList<>();
        if (files == null) {
            return paths;
        }
        Files.createDirectories(dir);
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            String name = Path.of(file.getOriginalFilename() == null ? "file.bin" : file.getOriginalFilename())
                    .getFileName()
                    .toString()
                    .replaceAll("[<>:\"/\\\\|?*]", "_");
            Path dest = dir.resolve(name);
            file.transferTo(dest);
            paths.add(dest.toAbsolutePath().toString());
        }
        return paths;
    }
}
