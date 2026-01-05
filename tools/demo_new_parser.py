#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DEMO: New Parser Usage
Minh họa cách sử dụng new_parser.py với sample data
"""

from new_parser import StockParser
import json
from pathlib import Path


def create_sample_data():
    """Tạo sample data để test parser"""
    sample_content = """
PHẦN I: TỔNG QUAN THỊ TRƯỜNG

1. TỔNG QUAN THỊ TRƯỜNG

Thị trường chứng khoán Việt Nam trong tuần qua ghi nhận xu hướng tích cực với VNINDEX tăng 2.5%.
Dòng tiền nội ổn định, nhà đầu tư nước ngoài tiếp tục mua ròng.


PHẦN II: PHÂN TÍCH CHỈ SỐ VNINDEX

XU HƯỚNG GIÁ

Ngắn hạn: VNINDEX đang trong xu hướng tăng mạnh
- Giá hiện tại: 1,250 điểm
- MA5: 1,240 điểm
- MA10: 1,230 điểm

Trung hạn: Xu hướng tăng được duy trì
- MA20: 1,200 điểm
- Momentum tích cực


XU HƯỚNG KHỐI LƯỢNG

Khối lượng giao dịch tăng đột biến:
- Khối lượng trung bình: 850 triệu CP/phiên
- Tăng 25% so với tuần trước


CUNG-CẦU

Cung: Áp lực bán yếu tại vùng 1,260
Cầu: Mua mạnh tại vùng 1,240


RỦI RO

Ngắn hạn: Rủi ro THẤP
- RSI chưa quá mua
- Hỗ trợ mạnh tại 1,240

Trung hạn: Rủi ro TRUNG BÌNH


KHUYẾN NGHỊ VỊ THẾ

- Nhà đầu tư ngắn hạn: MUA tích lũy tại vùng 1,240-1,245
- Nhà đầu tư dài hạn: GIỮ VỊ THẾ


1. Chỉ số VN30

XU HƯỚNG GIÁ

VN30 đang outperform VNINDEX:
- Giá hiện tại: 1,450 điểm
- Tăng 3.2% trong tuần


CUNG-CẦU

Cầu mạnh từ các cổ phiếu banking và bất động sản


RỦI RO

Rủi ro thấp trong ngắn hạn


1. VNREAL - Bất động sản

XU HƯỚNG GIÁ

Ngành bất động sản phục hồi tích cực:
- VNREAL tăng 4.5% trong tuần
- Dẫn dắt thị trường


BIẾN ĐỘNG GIÁ

Biến động tăng nhẹ do tin tốt từ chính sách


RỦI RO

Rủi ro vẫn còn cao do yếu tố vĩ mô
"""

    return sample_content


def main():
    """Demo chính"""
    print("=" * 80)
    print("DEMO: NEW PARSER - PHASE 2 REFACTOR")
    print("=" * 80)
    print()

    # 1. Tạo sample file
    sample_file = Path(__file__).parent.parent / "data" / "sample_report.txt"
    sample_file.parent.mkdir(exist_ok=True)

    sample_content = create_sample_data()
    sample_file.write_text(sample_content, encoding='utf-8')
    print(f"✅ Đã tạo sample file: {sample_file}")
    print()

    # 2. Khởi tạo parser
    print("🚀 Khởi tạo StockParser...")
    parser = StockParser(str(sample_file))
    print(f"   File size: {len(parser.content)} bytes")
    print()

    # 3. Parse document
    print("⚙️  Đang parse document...")
    data = parser.parse()
    print()

    # 4. Hiển thị summary
    print("=" * 80)
    print("📊 PARSING SUMMARY")
    print("=" * 80)
    summary = parser.get_summary()
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print()

    # 5. Hiển thị chi tiết một index
    print("=" * 80)
    print("🔍 CHI TIẾT VNINDEX")
    print("=" * 80)
    if 'vnindex' in data:
        vnindex_data = data['vnindex']
        print(f"Tổng số sections: {vnindex_data.get('total_sections', 0)}")
        print()
        for i, section in enumerate(vnindex_data.get('sections', []), 1):
            print(f"{i}. {section['icon']} {section['title']}")
            content_preview = section['content'][:100].replace('\n', ' ')
            print(f"   {content_preview}...")
            print()

    # 6. Lưu JSON
    output_file = Path(__file__).parent.parent / "data" / "parsed_output.json"
    parser.save_json(str(output_file))
    print()

    # 7. Performance metrics
    print("=" * 80)
    print("⚡ PERFORMANCE METRICS")
    print("=" * 80)
    metadata = data.get('_metadata', {})
    print(f"Parse time: {metadata.get('parse_time_seconds', 0):.4f}s")
    print(f"File size: {metadata.get('file_size_bytes', 0):,} bytes")
    print(f"Indices found: {metadata.get('total_indices_found', 0)}")
    print(f"Indices: {', '.join(metadata.get('indices', []))}")
    print()

    print("=" * 80)
    print("✅ DEMO COMPLETED!")
    print("=" * 80)
    print(f"\nOutput files:")
    print(f"  - Sample input: {sample_file}")
    print(f"  - Parsed JSON:  {output_file}")
    print()


if __name__ == '__main__':
    main()
