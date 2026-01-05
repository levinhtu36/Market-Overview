#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NEW PARSER - PHASE 2 REFACTOR (CORE ENGINE - P0)
Tối ưu hóa hiệu năng theo tư duy O(N) và JSON output

Key improvements:
- P0 Fix: Đọc file 1 lần duy nhất (I/O optimization)
- P0 Fix: O(N) union regex scanning (không quét lại nhiều lần)
- P0 Fix: JSON output an toàn (safe serialization)
- Performance: Timing measurements
"""

import re
import json
import time
import unicodedata
from pathlib import Path
from typing import Dict, List, Tuple, Any


class StockParser:
    """Parser tối ưu cho báo cáo chứng khoán Việt Nam"""

    # Tất cả 15 chỉ số chứng khoán được hỗ trợ
    ALL_INDEX_CODES = [
        'VNINDEX', 'VN30', 'VN100', 'VNMIDCAP', 'VNREAL',
        'VNIT', 'VNHEAL', 'VNFIN', 'VNENE', 'VNCONS',
        'VNMAT', 'VNCOND', 'VNSML', 'VNFINSELECT', 'VNDIAMOND'
    ]

    # Section definitions: (regex_pattern, icon, title)
    SECTION_DEFINITIONS = [
        (r'XU\s+HƯỚNG\s+GIÁ', '📈', 'XU HƯỚNG GIÁ'),
        (r'XU\s+HƯỚNG\s+KHỐI\s+LƯỢNG', '📊', 'XU HƯỚNG KHỐI LƯỢNG'),
        (r'KẾT\s+HỢP\s+XU\s+HƯỚNG\s+GIÁ\s+VÀ\s+KHỐI\s+LƯỢNG', '💹', 'KẾT HỢP XU HƯỚNG GIÁ VÀ KHỐI LƯỢNG'),
        (r'CUNG(?:\s*\-|\s+\-\s+)CẦU', '⚖️', 'CUNG-CẦU'),
        (r'MỨC\s+GIÁ\s+QUAN\s+TRỌNG', '🎯', 'MỨC GIÁ QUAN TRỌNG'),
        (r'BIẾN\s+ĐỘNG\s+GIÁ', '📉', 'BIẾN ĐỘNG GIÁ'),
        (r'MÔ\s+HÌNH\s+GIÁ(?:\s+\-|\s+\-\s+)MÔ\s+HÌNH\s+NẾN', '🕯️', 'MÔ HÌNH GIÁ - MÔ HÌNH NẾN'),
        (r'MARKET\s+BREADTH(?:\s+\&|\s+\&\s+)TÂM\s+LÝ\s+THỊ\s+TRƯỜNG', '👥', 'MARKET BREADTH & TÂM LÝ THỊ TRƯỜNG'),
        (r'LỊCH\s+SỬ(?:\s+\&|\s+\&\s+)XU\s+HƯỚNG\s+BREADTH', '📜', 'LỊCH SỬ & XU HƯỚNG BREADTH'),
        (r'RỦI\s+RO', '⚠️', 'RỦI RO'),
        (r'KHUYẾN\s+NGHỊ\s+VỊ\s+THẾ', '🎯', 'KHUYẾN NGHỊ VỊ THẾ'),
        (r'GIÁ\s+MỤC\s+TIÊU', '🎯', 'GIÁ MỤC TIÊU'),
        (r'KỊCH\s+BẢN\s+WHAT(?:\s+\-|\s+\-\s+)IF|WHAT\s+IF', '🎲', 'KỊCH BẢN WHAT-IF'),
    ]

    def __init__(self, file_path: str):
        """
        Khởi tạo parser

        Args:
            file_path: Đường dẫn đến file báo cáo (.txt)
        """
        self.file_path = file_path
        # Fix P0 - I/O: Đọc file 1 lần duy nhất
        self.content = Path(file_path).read_text(encoding='utf-8')
        self.data = {}

        # Precompile regex patterns (compile once, use many times)
        self._index_pattern = self._build_index_union_pattern()
        self._section_pattern = self._build_section_union_pattern()

    def _build_index_union_pattern(self) -> re.Pattern:
        """
        Build union regex pattern cho tất cả index headers - O(N) single pass

        Pattern matches:
        - PHẦN II: PHÂN TÍCH CHỈ SỐ VNINDEX
        - 1. Chỉ số VN30
        - 1. VNREAL - Bất động sản

        Returns:
            Compiled regex pattern
        """
        # Tạo alternation từ tất cả index codes
        code_alt = "|".join(map(re.escape, self.ALL_INDEX_CODES))

        # Union pattern với named groups để xác định loại match
        pattern = rf"""
            ^
            (?:
              PHẦN\s+[IVXLC]+\s*:\s*[^\n]*?\b(?P<part_code>{code_alt})\b
              |\s*\d+\.\s*Chỉ\s*số\s+(?P<chiso_code>{code_alt})\b
              |\s*PHÂN\s*TÍCH\s*CHỈ\s*SỐ\s+(?P<phan_tich_code>{code_alt})\b
              |\s*\d+\.\s*(?P<industry_code>{code_alt})\b\s+(?:-|—|:)
              |\s*\d+\.\s*(?P<bare_code>{code_alt})\b\s*(?![-|—|:])
            )
        """

        return re.compile(pattern, re.MULTILINE | re.IGNORECASE | re.VERBOSE)

    def _build_section_union_pattern(self) -> re.Pattern:
        """
        Build union regex pattern cho tất cả section headers - O(N) single pass

        Returns:
            Compiled regex pattern
        """
        # Optional prefix (numbering/bullets) và suffix (colon)
        prefix = r'(?:\s*(?:\d+\.\s*|\d+\)\s*|[A-Z]\)\s*|[-•]\s*))?'
        suffix = r'(?:\s*[:：])?'

        pattern_parts = []
        for i, (regex_key, _, _) in enumerate(self.SECTION_DEFINITIONS):
            group_name = f'sec{i}'
            pattern_parts.append(rf'(?P<{group_name}>{prefix}{regex_key}{suffix})')

        # Join với | (OR) và thêm anchors
        full_pattern = r'^\s*(' + '|'.join(pattern_parts) + r')\s*$'

        return re.compile(full_pattern, re.MULTILINE | re.IGNORECASE)

    def _normalize(self, text: str) -> str:
        """
        Chuẩn hóa văn bản cho robust parsing

        Args:
            text: Raw input text

        Returns:
            Normalized text
        """
        # 1. Strip BOM nếu có
        if text.startswith('\ufeff'):
            text = text[1:]

        # 2. Unicode normalization (NFC - composed form)
        text = unicodedata.normalize('NFC', text)

        # 3. Normalize newlines
        text = text.replace('\r\n', '\n').replace('\r', '\n')

        # 4. Replace weird Unicode line separators
        text = text.replace('\u2028', '\n').replace('\u2029', '\n')

        # 5. Remove zero-width spaces
        text = text.replace('\u200b', '')

        return text.strip()

    def _split_by_index(self, text: str) -> Dict[str, str]:
        """
        Chia văn bản thành các khối theo index - O(N) single pass

        Args:
            text: Normalized text

        Returns:
            Dict mapping index_code -> content_chunk
        """
        # Priority của các loại header (cao hơn = ưu tiên hơn)
        PRIORITY = {
            'part_code': 4,      # PHẦN II: ... VNINDEX (highest)
            'chiso_code': 3,     # 1. Chỉ số VN30
            'phan_tich_code': 3, # PHÂN TÍCH CHỈ SỐ VN30
            'industry_code': 2,  # 1. VNREAL - ...
            'bare_code': 1,      # 1. VNREAL (lowest)
        }

        matches = []

        # Fix P0 - O(N): Find ALL matches trong 1 lần quét
        for match in self._index_pattern.finditer(text):
            # Xác định group nào matched
            code = None
            group_name = None
            for gn in ['part_code', 'chiso_code', 'phan_tich_code', 'industry_code', 'bare_code']:
                group_value = match.group(gn)
                if group_value:
                    code = group_value.upper()  # Normalize to uppercase
                    group_name = gn
                    break

            if code and group_name:
                matches.append({
                    'code': code,
                    'start': match.start(),
                    'end': match.end(),
                    'priority': PRIORITY[group_name]
                })

        # Sort theo vị trí
        matches.sort(key=lambda m: m['start'])

        # Với mỗi code, chọn match có priority CAO NHẤT
        best_matches = {}
        for match in matches:
            code = match['code']
            if code not in best_matches or match['priority'] > best_matches[code]['priority']:
                best_matches[code] = match

        # Calculate boundaries: end = start của match tiếp theo, hoặc hết file
        sections = {}
        sorted_codes = sorted(best_matches.keys(), key=lambda c: best_matches[c]['start'])

        for i, code in enumerate(sorted_codes):
            start = best_matches[code]['end']  # Content bắt đầu SAU header
            if i + 1 < len(sorted_codes):
                next_code = sorted_codes[i + 1]
                end = best_matches[next_code]['start']  # Content kết thúc TRƯỚC header tiếp theo
            else:
                end = len(text)

            # Extract content chunk
            content_chunk = text[start:end].strip()
            sections[code.lower()] = content_chunk  # Store as lowercase key

        return sections

    def _parse_details(self, content: str, index_code: str) -> Dict[str, Any]:
        """
        Parse chi tiết các sections trong một index

        Args:
            content: Nội dung của index
            index_code: Code của index (lowercase)

        Returns:
            Dict chứa parsed data
        """
        # Find all section headers trong O(N)
        matches = list(self._section_pattern.finditer(content))

        if not matches:
            return {
                "error": f"No sections found for {index_code}",
                "raw_content": content[:200] + "..." if len(content) > 200 else content
            }

        sections = []

        # Process mỗi match
        for i, match in enumerate(matches):
            # Xác định section info từ match
            icon, title = None, None
            for j, (_, sec_icon, sec_title) in enumerate(self.SECTION_DEFINITIONS):
                group_name = f'sec{j}'
                if match.group(group_name):
                    icon, title = sec_icon, sec_title
                    break

            if not icon or not title:
                continue

            # Xác định section boundaries
            section_start = match.end()

            # End = start của section tiếp theo, hoặc end of content
            if i + 1 < len(matches):
                section_end = matches[i + 1].start()
            else:
                section_end = len(content)

            # Extract section content
            section_content = content[section_start:section_end].strip()

            if section_content:
                sections.append({
                    "icon": icon,
                    "title": title,
                    "content": section_content,
                    "is_alert": "KHUYẾN NGHỊ" in title
                })

        return {
            "index_code": index_code,
            "total_sections": len(sections),
            "sections": sections
        }

    def parse(self) -> Dict[str, Any]:
        """
        Parse toàn bộ document - Main method

        Returns:
            Dict chứa parsed data cho tất cả indices
        """
        start_time = time.perf_counter()

        # 1. Chuẩn hóa văn bản
        clean_text = self._normalize(self.content)

        # 2. Fix P0 - O(N): Quét toàn bộ Marker (Headers) bằng 1 Regex duy nhất
        sections = self._split_by_index(clean_text)

        # 3. Parse chi tiết từng index
        for index_code, content_chunk in sections.items():
            self.data[index_code] = self._parse_details(content_chunk, index_code)

        end_time = time.perf_counter()

        # Thêm metadata
        self.data['_metadata'] = {
            'parse_time_seconds': round(end_time - start_time, 4),
            'total_indices_found': len(sections),
            'indices': list(sections.keys()),
            'file_path': self.file_path,
            'file_size_bytes': len(self.content)
        }

        print(f"✅ Parsed xong trong {end_time - start_time:.4f}s")
        print(f"📊 Tìm thấy {len(sections)} chỉ số: {', '.join(sections.keys())}")

        return self.data

    def save_json(self, output_path: str) -> None:
        """
        Xuất ra JSON an toàn - Fix P0: Unsafe Output

        Args:
            output_path: Đường dẫn file JSON output
        """
        # Ensure data đã được parsed
        if not self.data:
            raise ValueError("No data to save. Call parse() first.")

        # Fix P0: JSON output an toàn với ensure_ascii=False để giữ tiếng Việt
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

        print(f"💾 Đã lưu JSON vào: {output_path}")

    def get_summary(self) -> Dict[str, Any]:
        """
        Lấy summary của parsed data

        Returns:
            Dict chứa summary info
        """
        if '_metadata' not in self.data:
            return {"error": "No data parsed yet"}

        summary = {
            "metadata": self.data['_metadata'],
            "indices_summary": {}
        }

        for index_code, index_data in self.data.items():
            if index_code == '_metadata':
                continue

            if isinstance(index_data, dict) and 'sections' in index_data:
                summary['indices_summary'][index_code] = {
                    "total_sections": index_data.get('total_sections', 0),
                    "section_titles": [s['title'] for s in index_data.get('sections', [])]
                }

        return summary


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

def main():
    """Example usage"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python new_parser.py <input_file.txt> [output_file.json]")
        print("\nExample:")
        print("  python new_parser.py ../reports/txt/baocao_full.txt ../data/market_data.json")
        return

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'output.json'

    # Khởi tạo parser
    parser = StockParser(input_file)

    # Parse document
    print("🚀 Bắt đầu parse document...")
    data = parser.parse()

    # Hiển thị summary
    print("\n📋 SUMMARY:")
    summary = parser.get_summary()
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    # Lưu JSON
    parser.save_json(output_file)

    print(f"\n✅ DONE! Đã parse {summary['metadata']['total_indices_found']} chỉ số")


if __name__ == '__main__':
    main()
